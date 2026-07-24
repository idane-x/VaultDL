/**
 * VimmClient — scrapes vimm.net/vault and builds download requests.
 *
 * The vault has no public API, so we parse HTML with cheerio. Two page shapes matter:
 *   - Listing:  /vault/{code}/{letter}  -> a table of games (one <tr> per title)
 *   - Detail:   /vault/{id}             -> embeds a `let media=[{...}]` JSON blob plus
 *                                          a <form id="dl_form" action="//dlN.vimm.net/">
 *
 * Downloading replicates the browser exactly: POST the form action with `mediaId`
 * (+ `alt` for alternate formats) and a real User-Agent + Referer header. The server
 * rejects requests missing those headers.
 *
 * Pure parsing lives in exported functions (parseListing / parseDetail) so they can be
 * unit-tested against saved HTML fixtures without any network.
 */
import * as cheerio from 'cheerio';
import type { GameDetail, GameListItem, MediaEntry, Region } from '@shared/types.js';
import { sectionToPath } from '@shared/systems.js';

export const VAULT_BASE = 'https://vimm.net/vault';

const REGION_MAP: Record<string, Region> = {
  usa: 'USA',
  us: 'USA',
  'united states': 'USA',
  europe: 'Europe',
  eu: 'Europe',
  japan: 'Japan',
  jp: 'Japan',
  asia: 'Asia',
  australia: 'Australia',
  korea: 'Korea',
  china: 'China',
  brazil: 'Brazil',
  world: 'World',
};

function normalizeRegion(title: string): Region {
  return REGION_MAP[title.trim().toLowerCase()] ?? 'Other';
}

/** Decode a base64 GoodTitle into a readable ROM filename. */
function decodeFilename(b64: string): string {
  try {
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return b64;
  }
}

/** Pull the numeric vault id out of an href like "/vault/94227". */
function vaultIdFromHref(href: string): number | null {
  const m = href.match(/\/vault\/(\d+)/);
  if (!m) return null;
  const id = Number(m[1]);
  // 999999 is a hidden sort-helper anchor present in every title cell — ignore it.
  return id === 999999 ? null : id;
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

/**
 * Parse a /vault/{code}/{letter} listing page. Columns vary per console, so we read
 * the header <th> row to build a name->index map and index each data row by it.
 */
export function parseListing(html: string): GameListItem[] {
  const $ = cheerio.load(html);
  const table = $('table.hovertable').first();
  if (table.length === 0) return [];

  // Header lives in a nested table inside the <caption>.
  const headers: string[] = [];
  table
    .find('caption th')
    .each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });
  const col = (name: string) => headers.findIndex((h) => h.includes(name));

  const idxTitle = col('title');
  const idxRegion = col('region');
  const idxVersion = col('version');
  const idxLang = col('language');
  const idxRating = col('rating');
  const idxSize = col('size');
  const idxSerial = col('serial');

  const items: GameListItem[] = [];

  // Data rows are the direct <tr> of the outer table (the caption's rows are excluded
  // because they live under <caption>, not the row body).
  table.find('> tbody > tr, > tr').each((_, tr) => {
    const tds = $(tr).find('> td');
    if (tds.length === 0) return;

    const titleCell = idxTitle >= 0 ? tds.eq(idxTitle) : tds.first();

    // The real game link is the anchor whose href is a numeric /vault/{id} and not 999999.
    let vaultId: number | null = null;
    let title = '';
    titleCell.find('a').each((__, a) => {
      const href = $(a).attr('href') ?? '';
      const id = vaultIdFromHref(href);
      if (id !== null && vaultId === null) {
        vaultId = id;
        title = $(a).text().trim();
      }
    });
    if (vaultId === null || !title) return;

    const regions: Region[] = [];
    if (idxRegion >= 0) {
      tds
        .eq(idxRegion)
        .find('img.flag')
        .each((__, img) => {
          const t = $(img).attr('title');
          if (t) regions.push(normalizeRegion(t));
        });
    }

    const textAt = (i: number): string | null => {
      if (i < 0) return null;
      const t = tds.eq(i).text().trim();
      return t.length ? t : null;
    };

    const langText = textAt(idxLang);
    const languages = langText
      ? langText
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    items.push({
      vaultId,
      title,
      regions,
      version: textAt(idxVersion),
      languages,
      rating: textAt(idxRating),
      sizeText: textAt(idxSize),
      serial: textAt(idxSerial),
      releaseDate: null,
    });
  });

  return items;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

interface RawMedia {
  ID: number;
  GoodTitle?: string;
  Serial?: string | null;
  SortOrder?: number;
  Version?: string | null;
  Zipped?: string | number;
  ZippedText?: string;
  GoodHash?: string | null;
  GoodMd5?: string | null;
  GoodSha1?: string | null;
  GoodDate?: { date?: string } | null;
}

/** Extract and JSON-parse the embedded `let media=[{...}]` array. */
function extractMediaBlob(html: string): RawMedia[] {
  const m = html.match(/let\s+media\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];
  try {
    return JSON.parse(m[1]) as RawMedia[];
  } catch {
    return [];
  }
}

function toBytes(zipped: string | number | undefined): number | null {
  if (zipped === undefined || zipped === null) return null;
  const n = typeof zipped === 'number' ? zipped : parseInt(zipped, 10);
  return Number.isFinite(n) ? n * 1024 : null; // Zipped is in KB
}

/**
 * Parse a /vault/{id} detail page into a GameDetail (download endpoint + media list).
 * `systemCode` is passed through since it isn't reliably on the page in a stable spot.
 */
export function parseDetail(html: string, vaultId: number, systemCode: string): GameDetail {
  const $ = cheerio.load(html);

  // Download endpoint: read the actual form action (host varies: dl2/dl3/dl5...).
  let action = $('#dl_form').attr('action') ?? '';
  if (action.startsWith('//')) action = 'https:' + action;
  else if (action.startsWith('/')) action = 'https://vimm.net' + action;

  // Release year from the info table's "Year" row.
  let year: string | null = null;
  $('td').each((_, td) => {
    if (year) return;
    if ($(td).text().trim().toLowerCase() === 'year') {
      const val = $(td).nextAll('td').last().text().trim();
      if (val && val !== '?') year = val;
    }
  });

  const regions: Region[] = [];
  $('img.flag').each((_, img) => {
    const t = $(img).attr('title');
    if (t) regions.push(normalizeRegion(t));
  });

  const raw = extractMediaBlob(html);
  const media: MediaEntry[] = raw
    .map((r) => ({
      mediaId: r.ID,
      filename: r.GoodTitle ? decodeFilename(r.GoodTitle) : `vault-${r.ID}`,
      version: r.Version ?? null,
      serial: r.Serial ?? null,
      sizeText: r.ZippedText ?? null,
      sizeBytes: toBytes(r.Zipped),
      sortOrder: r.SortOrder ?? 0,
      releaseDate: r.GoodDate?.date ? r.GoodDate.date.slice(0, 10) : year,
      crc: r.GoodHash ?? null,
      md5: r.GoodMd5 ?? null,
      sha1: r.GoodSha1 ?? null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const title = media[0]?.filename.replace(/\.[^.]+$/, '') ?? `Vault ${vaultId}`;

  return { vaultId, systemCode, title, regions, downloadAction: action, media };
}

// ---------------------------------------------------------------------------
// Network wrappers (thin — parsing above is what gets unit tested)
// ---------------------------------------------------------------------------

export interface FetchDeps {
  userAgent: string;
  fetchImpl?: typeof fetch;
}

export async function fetchListing(
  systemCode: string,
  letter: string,
  deps: FetchDeps,
): Promise<GameListItem[]> {
  const f = deps.fetchImpl ?? fetch;
  const url = `${VAULT_BASE}/${systemCode}/${sectionToPath(letter)}`;
  const res = await f(url, { headers: { 'User-Agent': deps.userAgent } });
  if (!res.ok) throw new Error(`Listing ${systemCode}/${letter} failed: HTTP ${res.status}`);
  return parseListing(await res.text());
}

export async function fetchDetail(
  vaultId: number,
  systemCode: string,
  deps: FetchDeps,
): Promise<GameDetail> {
  const f = deps.fetchImpl ?? fetch;
  const url = `${VAULT_BASE}/${vaultId}`;
  const res = await f(url, { headers: { 'User-Agent': deps.userAgent } });
  if (!res.ok) throw new Error(`Detail ${vaultId} failed: HTTP ${res.status}`);
  return parseDetail(await res.text(), vaultId, systemCode);
}

/**
 * Build the exact request needed to download a media entry. The DownloadManager uses
 * this and streams the response body to disk.
 *
 * Verified against the live site: the download host serves the file for a **GET** with
 * `mediaId` as a query param. Two headers are mandatory — the server returns HTTP 400
 * without them:
 *   - `Referer` pointing at the game's vault page
 *   - a real browser `User-Agent`
 * (A session cookie is NOT required.) The page's <form> nominally uses POST, but POST is
 * currently rejected; GET is what actually works.
 */
export function buildDownloadRequest(
  detail: GameDetail,
  altIndex: number,
  userAgent: string,
): { url: string; init: RequestInit } {
  const entry = detail.media[altIndex] ?? detail.media[0];
  const base = detail.downloadAction.endsWith('/')
    ? detail.downloadAction
    : detail.downloadAction + '/';
  const params = new URLSearchParams();
  params.set('mediaId', String(entry.mediaId));
  // `alt` selects an alternate format; 0 is the default, so only send a non-zero alt.
  if (altIndex > 0) params.set('alt', String(altIndex));
  return {
    url: `${base}?${params.toString()}`,
    init: {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Referer: `${VAULT_BASE}/${detail.vaultId}`,
      },
    },
  };
}
