/**
 * RomsfunClient — talks to romsfun.com's WordPress REST API (`/wp-json/wp/v2`) and scrapes
 * its download-resolution page. Two shapes matter:
 *
 *   - Rom list: `GET /wp-json/wp/v2/rom?...` -> a JSON array of `{ id, slug, link, title, console }`
 *               objects, paginated via `X-WP-Total` / `X-WP-TotalPages` response headers.
 *   - Download page: `GET /download/{slug}-{id}/{variant}` -> an HTML page whose
 *               `<a id="download-link">` holds the real (token-expiring) CDN URL. The CDN
 *               host is NOT stable (seen both `sto.romsfast.com` and `statics.romsfun.com`),
 *               so extraction is done purely by element id, never by hostname matching.
 *
 * Pure parsing lives in exported functions (parseRomList / parseDownloadPage / parseSizeText)
 * so they can be unit-tested against saved fixtures without any network. Network wrappers
 * below are thin by design — mirrors the split used in VimmClient.ts.
 */
import * as cheerio from 'cheerio';
import { SYSTEMS } from '@shared/systems.js';
import type { GameListItem, ListPage, ListQuery, SourceRef } from '@shared/types.js';

export const ROMSFUN_BASE = 'https://romsfun.com';
export const ROMSFUN_API = ROMSFUN_BASE + '/wp-json/wp/v2';

export interface FetchDeps {
  userAgent: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Reverse lookup: romsfun console slug -> our canonical system code. */
const SYSTEM_CODE_BY_ROMSFUN_SLUG: Record<string, string> = Object.fromEntries(
  SYSTEMS.filter((s) => s.romsfun).map((s) => [s.romsfun as string, s.code]),
);

/**
 * Decode HTML entities (numeric, hex and named — `&#8211;`, `&#x27;`, `&amp;`, ...) the
 * WordPress REST API leaves in `title.rendered`. Routed through cheerio's own HTML parser
 * rather than a hand-rolled entity table, since that's already a dependency and handles the
 * full named-entity set correctly.
 */
function decodeHtmlEntities(s: string): string {
  return cheerio.load(`<div>${s}</div>`)('div').text();
}

/** Pull the console slug out of a rom's page link: `.../roms/{consoleSlug}/{slug}.html`. */
function consoleSlugFromLink(link: string): string | null {
  const m = link.match(/\/roms\/([^/]+)\//);
  return m ? m[1] : null;
}

/**
 * Parse a human size string ("137.52KB", "1.19 G", "700 MB", "489.47 K") into bytes.
 * Binary (1024-based) units, matching how the fixtures were verified.
 */
export function parseSizeText(s: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^([\d.,]+)\s*([A-Za-z]+)$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;

  const unit = m[2].toUpperCase();
  const MULTIPLIERS: Record<string, number> = {
    B: 1,
    K: 1024,
    KB: 1024,
    M: 1024 ** 2,
    MB: 1024 ** 2,
    G: 1024 ** 3,
    GB: 1024 ** 3,
    T: 1024 ** 4,
    TB: 1024 ** 4,
  };
  const mult = MULTIPLIERS[unit];
  if (mult === undefined) return null;
  return Math.round(num * mult);
}

// ---------------------------------------------------------------------------
// Rom list (pure)
// ---------------------------------------------------------------------------

interface RawRom {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  console: number[];
}

export interface ParseRomListOpts {
  /** True for a cross-console `&search=` query (no `console=` param was sent). */
  isSearch: boolean;
  /** 1-based page number this JSON page represents. */
  page: number;
  /** Total page count, read from the `X-WP-TotalPages` response header. */
  totalPages: number;
}

/**
 * Parse a `/wp-json/wp/v2/rom` JSON page into a ListPage. Purely a mapping step — no
 * network, no header access (pagination facts come in via `opts`, read by the caller from
 * the response headers, since JSON bodies don't carry them).
 */
export function parseRomList(json: unknown, opts: ParseRomListOpts): ListPage {
  const rows = Array.isArray(json) ? (json as RawRom[]) : [];
  const items: GameListItem[] = rows.map((r) => {
    const consoleSlug = consoleSlugFromLink(r.link);
    const systemCode = consoleSlug ? (SYSTEM_CODE_BY_ROMSFUN_SLUG[consoleSlug] ?? null) : null;
    const title = decodeHtmlEntities(r.title.rendered);

    const sourceRef: SourceRef = {
      source: 'romsfun',
      id: String(r.id),
      slug: r.slug,
      consoleSlug: consoleSlug ?? undefined,
      variant: 1,
    };

    return {
      vaultId: 0,
      source: 'romsfun',
      sourceRef,
      title,
      systemCode,
      // romsfun has no region data on the listing — region text (if any) lives inside the
      // title itself, so we do not attempt to invent structured regions here.
      regions: [],
      version: null,
      languages: [],
      rating: null,
      sizeText: null,
      serial: null,
      unlicensed: false,
      releaseDate: null,
    };
  });

  return {
    items,
    page: opts.page,
    hasMore: opts.page < opts.totalPages,
    isSearch: opts.isSearch,
  };
}

// ---------------------------------------------------------------------------
// Download page (pure)
// ---------------------------------------------------------------------------

export interface ParsedDownloadPage {
  url: string;
  filename: string | null;
  sizeText: string | null;
  /** Set when the link leaves romsfun for a third-party file host (see EXTERNAL_HOSTS). */
  externalHost: string | null;
}

/**
 * File hosts romsfun offloads its largest titles to (PS4 ISOs and similar). These serve an
 * HTML landing page behind their own wait timer / free-tier limits rather than the file, so
 * the app hands off to the browser instead of trying to drive that gate.
 */
const EXTERNAL_HOSTS = [
  '1fichier.com',
  'mega.nz',
  'mediafire.com',
  'drive.google.com',
  'gofile.io',
  'pixeldrain.com',
  'krakenfiles.com',
];

/** Returns the matched external host for a URL, or null when it's a direct file link. */
export function externalHostFor(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
  return EXTERNAL_HOSTS.find((h) => host === h || host.endsWith('.' + h)) ?? null;
}

/**
 * Parse a `/download/{slug}-{id}/{variant}` page. The CDN host embedded in the href varies
 * (confirmed both `sto.romsfast.com` and `statics.romsfun.com` in the wild), so extraction
 * keys ONLY on the `a#download-link` element id — never on the URL's hostname. Throws loudly
 * if that element is missing, since a silent null here would surface as a confusing
 * downstream download failure instead of a clear "the site changed" signal.
 */
export function parseDownloadPage(html: string): ParsedDownloadPage {
  const $ = cheerio.load(html);
  const link = $('a#download-link').first();
  if (link.length === 0) {
    throw new Error(
      'romsfun download page: no <a id="download-link"> found — the page layout may have changed',
    );
  }
  const href = link.attr('href');
  if (!href) {
    throw new Error('romsfun download page: a#download-link element has no href attribute');
  }

  // "You are downloading {NAME} ()" heading holds the real filename.
  let filename: string | null = null;
  $('h1').each((_, el) => {
    if (filename) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const m = text.match(/You are downloading\s+(.+?)\s*\(\)\s*$/);
    if (m) filename = decodeHtmlEntities(m[1].trim());
  });

  // The download button's own text ends "...Download Now  (137.52KB)" / "(1.19 G)".
  let sizeText: string | null = null;
  const btnText = link.text().replace(/\s+/g, ' ').trim();
  const sizeMatch = btnText.match(/\(([^()]+)\)\s*$/);
  if (sizeMatch) sizeText = sizeMatch[1].trim();

  return { url: href, filename, sizeText, externalHost: externalHostFor(href) };
}

// ---------------------------------------------------------------------------
// Network wrappers (thin — parsing above is what gets unit tested)
// ---------------------------------------------------------------------------

/** Module-level memoized console-taxonomy fetch (slug -> WordPress term id). Never disk-cached. */
let consoleMapPromise: Promise<Map<string, number>> | null = null;

export async function fetchConsoleMap(deps: FetchDeps): Promise<Map<string, number>> {
  if (!consoleMapPromise) {
    consoleMapPromise = (async () => {
      const f = deps.fetchImpl ?? fetch;
      const url = `${ROMSFUN_API}/console?per_page=100&_fields=id,slug,count`;
      const res = await f(url, { headers: { 'User-Agent': deps.userAgent } });
      if (!res.ok) {
        throw new Error(`romsfun console taxonomy request failed: HTTP ${res.status}`);
      }
      const rows = (await res.json()) as Array<{ id: number; slug: string; count: number }>;
      return new Map(rows.map((r) => [r.slug, r.id]));
    })().catch((err) => {
      // Don't poison the cache with a rejected promise — let the next call retry.
      consoleMapPromise = null;
      throw err;
    });
  }
  return consoleMapPromise;
}

/** Build the `/wp-json/wp/v2/rom` query URL for either a console browse or a global search. */
function buildRomListUrl(query: ListQuery, termId: number | null): string {
  const isSearch = !query.systemCode && !!query.q;
  const params = new URLSearchParams();
  if (isSearch) {
    params.set('search', query.q as string);
  } else if (termId !== null) {
    params.set('console', String(termId));
  }
  params.set('orderby', 'title');
  params.set('order', 'asc');
  params.set('per_page', '50');
  params.set('page', String(query.page));
  params.set('_fields', 'id,slug,link,title,console');
  return `${ROMSFUN_API}/rom?${params.toString()}`;
}

export async function fetchRomList(query: ListQuery, deps: FetchDeps): Promise<ListPage> {
  const f = deps.fetchImpl ?? fetch;
  const isSearch = !query.systemCode && !!query.q;

  let termId: number | null = null;
  if (!isSearch) {
    const system = SYSTEMS.find((s) => s.code === query.systemCode);
    const slug = system?.romsfun;
    if (!slug) {
      // Nothing to browse — this system isn't carried by romsfun.
      return { items: [], page: query.page, hasMore: false, isSearch };
    }
    const consoleMap = await fetchConsoleMap(deps);
    termId = consoleMap.get(slug) ?? null;
    if (termId === null) {
      return { items: [], page: query.page, hasMore: false, isSearch };
    }
  }

  const url = buildRomListUrl(query, termId);
  const res = await f(url, { headers: { 'User-Agent': deps.userAgent } });
  if (!res.ok) throw new Error(`romsfun rom list request failed: HTTP ${res.status}`);

  const totalPages = Number(res.headers.get('X-WP-TotalPages') ?? '1') || 1;
  const json = await res.json();
  return parseRomList(json, { isSearch, page: query.page, totalPages });
}

export interface ResolvedDownloadTarget {
  url: string;
  filename: string | null;
  sizeBytes: number | null;
  /** The download-resolution page URL — used as the `Referer` for the actual file GET. */
  refererUsed: string;
  /** Non-null when the link leaves romsfun for a gated third-party host. */
  externalHost: string | null;
}

/**
 * Resolve a romsfun `SourceRef` into a concrete (token-bearing, time-limited) download URL.
 * MUST be called at download time, never cached — the CDN link's `?token=` expires after a
 * few hours. Two network round-trips, per the mechanics verified against the live site:
 *   1. GET the `/download/{slug}-{id}/{variant}` resolution page (needs UA + a Referer
 *      pointing at the game's own `/roms/{consoleSlug}/{slug}.html` page).
 *   2. (left to the caller) GET the extracted CDN url, with the resolution page itself as
 *      the Referer this time.
 */
export async function fetchDownloadTarget(
  ref: SourceRef,
  deps: FetchDeps,
): Promise<ResolvedDownloadTarget> {
  if (!ref.slug) {
    throw new Error('romsfun download resolution requires sourceRef.slug');
  }
  const f = deps.fetchImpl ?? fetch;
  const variant = ref.variant ?? 1;
  const downloadPageUrl = `${ROMSFUN_BASE}/download/${ref.slug}-${ref.id}/${variant}`;
  const gamePageUrl = ref.consoleSlug
    ? `${ROMSFUN_BASE}/roms/${ref.consoleSlug}/${ref.slug}.html`
    : ROMSFUN_BASE;

  const res = await f(downloadPageUrl, {
    headers: { 'User-Agent': deps.userAgent, Referer: gamePageUrl },
  });
  if (!res.ok) {
    throw new Error(`romsfun download page request failed: HTTP ${res.status}`);
  }

  const { url, filename, sizeText, externalHost } = parseDownloadPage(await res.text());
  return {
    url,
    filename,
    sizeBytes: sizeText ? parseSizeText(sizeText) : null,
    refererUsed: downloadPageUrl,
    externalHost,
  };
}
