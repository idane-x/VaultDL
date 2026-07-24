/**
 * MetadataService — resolves box art (TheGamesDB) + Metacritic score (RAWG) for a vault
 * game, caches the result (memory + userData JSON, mirroring CacheStore.ts's pattern),
 * and downloads the matched cover into the shared art cache directory so the renderer can
 * load it through the `artcache://` protocol.
 *
 * Both providers are optional and independent: a game can have art without a score, a
 * score without art, or neither. Network calls are never allowed to throw out of this
 * module — every provider call already guards itself (see TgdbProvider/RawgProvider), and
 * getMeta/overrideMeta additionally wrap their whole body in try/catch so a truly
 * unexpected failure (e.g. disk I/O) still resolves to a well-formed GameMeta.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { GameMeta, MetaCandidate, MetaLookup, MetaStatus } from '@shared/types.js';
import { artcacheUrl } from '@shared/artcache.js';
import { getSettings } from './SettingsStore.js';
import { artcacheDir } from './paths.js';
import { getPlatformIds } from './metadata/platforms.js';
import { pickBest } from './metadata/match.js';
import { searchArt } from './metadata/TgdbProvider.js';
import { searchScore, type RawgSearchResult } from './metadata/RawgProvider.js';

const FILE_NAME = 'metadata-cache.json';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CANDIDATES = 8;
const MAX_CONCURRENT_DOWNLOADS = 3;

interface MetaCacheEntry {
  meta: Omit<GameMeta, 'candidates'>;
  /** TGDB art candidates for this lookup, kept around so overrideMeta rarely re-fetches. */
  candidates: MetaCandidate[];
  fetchedAt: number;
}

type MetaCacheFile = Record<string, MetaCacheEntry>;

interface ArtResolution {
  boxArtUrl: string | null;
  matchedTitle: string | null;
  year: string | null;
  candidates: MetaCandidate[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Caps concurrent image downloads so scrolling a long list can't fire hundreds at once. */
class ConcurrencyLimiter {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const downloadLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_DOWNLOADS);

function cacheKey(lookup: MetaLookup): string {
  return `${lookup.systemCode}:${lookup.vaultId}`;
}

function extFromUrl(url: string): string {
  const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|#|$)/i);
  const raw = m ? m[1].toLowerCase() : 'jpg';
  return raw === 'jpeg' ? 'jpg' : raw;
}

/** Download `url` to `destPath` (skipping if already cached). Never throws. */
async function downloadImage(url: string, destPath: string, userAgent: string): Promise<boolean> {
  try {
    if (fs.existsSync(destPath)) return true;
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buf);
    return true;
  } catch (err) {
    console.warn('[MetadataService] image download failed:', err);
    return false;
  }
}

function emptyMeta(lookup: MetaLookup, status: MetaStatus): GameMeta {
  return {
    vaultId: lookup.vaultId,
    systemCode: lookup.systemCode,
    matchedTitle: null,
    boxArtUrl: null,
    metascore: null,
    releaseDate: null,
    status,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MetadataServiceImpl {
  private cache: MetaCacheFile = {};
  private loaded = false;
  private filePath: string | null = null;

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = path.join(app.getPath('userData'), FILE_NAME);
    }
    return this.filePath;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.getFilePath(), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.cache = parsed as MetaCacheFile;
      }
    } catch {
      // No cache file yet, or it's corrupt — start fresh.
      this.cache = {};
    }
  }

  private persist(): void {
    try {
      const filePath = this.getFilePath();
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(this.cache), 'utf-8');
    } catch {
      // Best-effort: the in-memory cache still works for the rest of this session.
    }
  }

  private getCached(key: string): MetaCacheEntry | null {
    this.ensureLoaded();
    const entry = this.cache[key];
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      delete this.cache[key];
      return null;
    }
    return entry;
  }

  private setCached(key: string, entry: MetaCacheEntry): void {
    this.ensureLoaded();
    this.cache[key] = entry;
    this.persist();
  }

  /** Run the TGDB art lookup, pick the best match, and download its front cover. */
  private async resolveArt(
    lookup: MetaLookup,
    tgdbApiKey: string,
    userAgent: string,
  ): Promise<ArtResolution> {
    const { tgdb: tgdbPlatformId } = getPlatformIds(lookup.systemCode);
    const { candidates: tgdbCandidates } = await searchArt(
      lookup.title,
      tgdbPlatformId,
      tgdbApiKey,
      userAgent,
    );

    const metaCandidates: MetaCandidate[] = tgdbCandidates.slice(0, MAX_CANDIDATES).map((c) => ({
      id: c.id,
      title: c.title,
      year: c.year,
      thumbUrl: c.boxFrontUrl,
    }));

    const best = pickBest(lookup.title, tgdbCandidates, (c) => c.title);
    if (!best || !best.item.boxFrontUrl) {
      return {
        boxArtUrl: null,
        matchedTitle: best?.item.title ?? null,
        year: best?.item.year ?? null,
        candidates: metaCandidates,
      };
    }

    const frontUrl = best.item.boxFrontUrl;
    const ext = extFromUrl(frontUrl);
    const relPath = `tgdb/${best.item.id}.${ext}`;
    const destPath = path.join(artcacheDir(), relPath);
    const ok = await downloadLimiter.run(() => downloadImage(frontUrl, destPath, userAgent));

    return {
      boxArtUrl: ok ? artcacheUrl(relPath) : null,
      matchedTitle: best.item.title,
      year: best.item.year,
      candidates: metaCandidates,
    };
  }

  async getMeta(lookup: MetaLookup, withCandidates = false): Promise<GameMeta> {
    try {
      const settings = getSettings();
      if (!settings.metadataEnabled) return emptyMeta(lookup, 'ok');
      if (!settings.tgdbApiKey && !settings.rawgApiKey) return emptyMeta(lookup, 'no-key');

      const key = cacheKey(lookup);
      const cached = this.getCached(key);

      if (cached && (!withCandidates || cached.candidates.length > 0)) {
        return withCandidates
          ? { ...cached.meta, candidates: cached.candidates }
          : { ...cached.meta };
      }

      if (cached && withCandidates && cached.candidates.length === 0 && settings.tgdbApiKey) {
        // Cached hit, but candidates weren't kept (or none matched) — re-run just the art
        // lookup to populate them without disturbing the cached score.
        const art = await this.resolveArt(lookup, settings.tgdbApiKey, settings.userAgent);
        this.setCached(key, {
          meta: cached.meta,
          candidates: art.candidates,
          fetchedAt: cached.fetchedAt,
        });
        return { ...cached.meta, candidates: art.candidates };
      }

      const { rawg: rawgPlatformId } = getPlatformIds(lookup.systemCode);

      const [artResult, scoreResult] = await Promise.all([
        settings.tgdbApiKey
          ? this.resolveArt(lookup, settings.tgdbApiKey, settings.userAgent)
          : Promise.resolve<ArtResolution>({
              boxArtUrl: null,
              matchedTitle: null,
              year: null,
              candidates: [],
            }),
        settings.rawgApiKey
          ? searchScore(lookup.title, rawgPlatformId, settings.rawgApiKey, settings.userAgent)
          : Promise.resolve<RawgSearchResult>({
              metascore: null,
              released: null,
              matchedName: null,
              candidates: [],
            }),
      ]);

      const matchedTitle = artResult.matchedTitle ?? scoreResult.matchedName ?? null;
      const releaseDate = artResult.year ?? scoreResult.released ?? null;
      const status: MetaStatus =
        artResult.boxArtUrl !== null || scoreResult.metascore !== null ? 'ok' : 'no-match';

      const meta: Omit<GameMeta, 'candidates'> = {
        vaultId: lookup.vaultId,
        systemCode: lookup.systemCode,
        matchedTitle,
        boxArtUrl: artResult.boxArtUrl,
        metascore: scoreResult.metascore,
        releaseDate,
        status,
      };

      this.setCached(key, { meta, candidates: artResult.candidates, fetchedAt: Date.now() });

      return withCandidates ? { ...meta, candidates: artResult.candidates } : meta;
    } catch (err) {
      console.warn('[MetadataService] getMeta failed:', err);
      return emptyMeta(lookup, 'error');
    }
  }

  async overrideMeta(lookup: MetaLookup, candidateId: string): Promise<GameMeta> {
    try {
      const settings = getSettings();
      if (!settings.metadataEnabled) return emptyMeta(lookup, 'ok');
      if (!settings.tgdbApiKey) return emptyMeta(lookup, 'no-key');

      const key = cacheKey(lookup);
      const cached = this.getCached(key);

      let candidates = cached?.candidates ?? [];
      let picked = candidates.find((c) => c.id === candidateId) ?? null;

      if (!picked) {
        // Not in the cached list (cache empty, expired, or a stale candidate id) — re-run
        // the search to (re)locate it.
        const { tgdb: tgdbPlatformId } = getPlatformIds(lookup.systemCode);
        const result = await searchArt(
          lookup.title,
          tgdbPlatformId,
          settings.tgdbApiKey,
          settings.userAgent,
        );
        candidates = result.candidates.slice(0, MAX_CANDIDATES).map((c) => ({
          id: c.id,
          title: c.title,
          year: c.year,
          thumbUrl: c.boxFrontUrl,
        }));
        picked = candidates.find((c) => c.id === candidateId) ?? null;
      }

      const baseMeta: Omit<GameMeta, 'candidates'> = cached?.meta ?? {
        vaultId: lookup.vaultId,
        systemCode: lookup.systemCode,
        matchedTitle: null,
        boxArtUrl: null,
        metascore: null,
        releaseDate: null,
        status: 'no-match',
      };

      if (!picked) {
        // Requested candidate doesn't exist (stale override) — leave metadata unchanged.
        return { ...baseMeta, candidates };
      }

      // MetaCandidate.thumbUrl is TGDB's "original" (full-resolution) front cover URL for
      // this candidate, so it doubles as the download source — no second lookup needed.
      let boxArtUrl = baseMeta.boxArtUrl;
      if (picked.thumbUrl) {
        const thumbUrl = picked.thumbUrl;
        const ext = extFromUrl(thumbUrl);
        const relPath = `tgdb/${picked.id}.${ext}`;
        const destPath = path.join(artcacheDir(), relPath);
        const ok = await downloadLimiter.run(() =>
          downloadImage(thumbUrl, destPath, settings.userAgent),
        );
        boxArtUrl = ok ? artcacheUrl(relPath) : boxArtUrl;
      }

      const updatedMeta: Omit<GameMeta, 'candidates'> = {
        ...baseMeta,
        matchedTitle: picked.title,
        boxArtUrl,
        releaseDate: picked.year ?? baseMeta.releaseDate,
        status: boxArtUrl !== null || baseMeta.metascore !== null ? 'ok' : 'no-match',
      };

      this.setCached(key, { meta: updatedMeta, candidates, fetchedAt: Date.now() });

      return { ...updatedMeta, candidates };
    } catch (err) {
      console.warn('[MetadataService] overrideMeta failed:', err);
      return emptyMeta(lookup, 'error');
    }
  }
}

export const MetadataService = new MetadataServiceImpl();
