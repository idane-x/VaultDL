/**
 * Live end-to-end check (hits vimm.net + downloads one tiny ROM). Opt-in only, so the
 * default `npm test` stays offline and fast. Run it with:  LIVE=1 npm test
 */
import { describe, it, expect } from 'vitest';

const live = process.env.LIVE === '1' ? describe : describe.skip;
import { mkdtempSync, createWriteStream, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import {
  fetchList,
  fetchDetail,
  buildDownloadRequest,
} from '../electron/services/VimmClient.js';
import {
  fetchRomList,
  fetchDownloadTarget,
} from '../electron/services/sources/RomsfunClient.js';
import { mergeSourceItems } from '../electron/services/merge.js';
import { extractArchive } from '../electron/services/Extractor.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

live('LIVE vimm.net end-to-end', () => {
  it('lists → details → downloads → extracts a small NES ROM', async () => {
    // 1. Listing (advanced list, NES / USA)
    const listPage = await fetchList(
      { systemCode: 'NES', regionId: '25', sort: 'Title', sortOrder: 'ASC', page: 1 },
      { userAgent: UA },
    );
    const items = listPage.items;
    console.log(`[listing] NES/USA page 1 returned ${items.length} games (hasMore=${listPage.hasMore})`);
    expect(items.length).toBeGreaterThan(5);

    // Pick a genuinely small title: fetch details until we find one < 256 KB.
    let chosen = null as null | { detail: Awaited<ReturnType<typeof fetchDetail>> };
    for (const it of items.slice(0, 8)) {
      const detail = await fetchDetail(it.vaultId, 'NES', { userAgent: UA });
      const bytes = detail.media[0]?.sizeBytes ?? Number.MAX_SAFE_INTEGER;
      console.log(
        `[detail] ${it.title} -> mediaId=${detail.media[0]?.mediaId} action=${detail.downloadAction} size=${detail.media[0]?.sizeText}`,
      );
      if (bytes < 256 * 1024 && detail.downloadAction) {
        chosen = { detail };
        break;
      }
    }
    expect(chosen).not.toBeNull();
    const detail = chosen!.detail;
    expect(detail.downloadAction).toMatch(/^https:\/\/dl\d*\.vimm\.net\//);
    expect(detail.media[0].mediaId).toBeGreaterThan(0);

    // 2. Real download (POST with mediaId + UA + Referer)
    const { url, init } = buildDownloadRequest(detail, 0, UA);
    const res = await fetch(url, init);
    console.log(
      `[download] HTTP ${res.status} type=${res.headers.get('content-type')} disp=${res.headers.get('content-disposition')}`,
    );
    expect(res.ok).toBe(true);
    expect(res.body).not.toBeNull();

    const dir = mkdtempSync(path.join(tmpdir(), 'vimm-verify-'));
    const archivePath = path.join(dir, 'download.zip');
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(archivePath);
      const nodeStream = Writable.toWeb(out);
      (res.body as ReadableStream)
        .pipeTo(nodeStream)
        .then(resolve)
        .catch(reject);
    });
    const archiveSize = statSync(archivePath).size;
    console.log(`[download] wrote ${archiveSize} bytes to ${archivePath}`);
    expect(archiveSize).toBeGreaterThan(1000);

    // 3. Extraction via node-7z + 7zip-bin
    await extractArchive(archivePath, dir);
    const extracted = readdirSync(dir).filter((f) => f !== 'download.zip');
    console.log(`[extract] produced: ${extracted.join(', ')}`);
    expect(extracted.length).toBeGreaterThan(0);
    expect(existsSync(path.join(dir, extracted[0]))).toBe(true);
  }, 60_000);
});

/**
 * romsfun sits behind Cloudflare TLS fingerprinting: Node/undici gets a hard HTTP 403 on
 * every request regardless of headers, while Electron's Chromium-backed net.fetch is
 * accepted (verified side by side in one process — 403 vs 200 on identical URLs). The app
 * therefore routes all traffic through appFetch/net.fetch, which vitest cannot use.
 *
 * So these two suites stay skipped under plain Node. The faithful live check runs in the
 * real runtime instead:   npm run verify:romsfun   (npx electron scripts/verify-romsfun.cjs)
 */
const liveRomsfun = process.env.LIVE_ROMSFUN === '1' ? describe : describe.skip;

liveRomsfun('LIVE romsfun.com end-to-end', () => {
  it('lists → resolves a token URL → downloads → extracts a small Game Boy ROM', async () => {
    // 1. Listing via the WordPress REST API (Game Boy, title-ascending).
    const page = await fetchRomList(
      { systemCode: 'GB', regionId: '25', sort: 'Title', sortOrder: 'ASC', page: 1 },
      { userAgent: UA },
    );
    console.log(
      `[romsfun] GB page 1 returned ${page.items.length} games (hasMore=${page.hasMore})`,
    );
    expect(page.items.length).toBeGreaterThan(5);
    expect(page.items.every((i) => i.source === 'romsfun')).toBe(true);
    expect(page.items.every((i) => i.systemCode === 'GB')).toBe(true);

    // 2. Resolve a concrete download URL. The CDN host varies (statics.romsfun.com vs
    //    sto.romsfast.com) and the link carries an expiring token, so this is done live
    //    rather than cached.
    const target = await fetchDownloadTarget(page.items[0].sourceRef, { userAgent: UA });
    console.log(
      `[romsfun] resolved host=${new URL(target.url).host} file=${target.filename} size=${target.sizeBytes}`,
    );
    expect(target.url).toMatch(/^https:\/\//);
    expect(target.url).toContain('token=');

    // 3. Range request proves resume support (Accept-Ranges / 206).
    const probe = await fetch(target.url, {
      headers: { 'User-Agent': UA, Referer: target.refererUsed, Range: 'bytes=0-1023' },
    });
    console.log(`[romsfun] range probe HTTP ${probe.status}`);
    expect(probe.status).toBe(206);
    await probe.arrayBuffer();

    // 4. Full download + extraction.
    const res = await fetch(target.url, {
      headers: { 'User-Agent': UA, Referer: target.refererUsed },
    });
    expect(res.ok).toBe(true);
    expect(res.body).not.toBeNull();

    const dir = mkdtempSync(path.join(tmpdir(), 'romsfun-verify-'));
    const archivePath = path.join(dir, 'download.zip');
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(archivePath);
      (res.body as ReadableStream).pipeTo(Writable.toWeb(out)).then(resolve).catch(reject);
    });
    const size = statSync(archivePath).size;
    console.log(`[romsfun] wrote ${size} bytes`);
    expect(size).toBeGreaterThan(1000);

    await extractArchive(archivePath, dir);
    const extracted = readdirSync(dir).filter((f) => f !== 'download.zip');
    console.log(`[romsfun] extracted: ${extracted.join(', ')}`);
    expect(extracted.length).toBeGreaterThan(0);
  }, 120_000);
});

liveRomsfun('LIVE cross-source merge', () => {
  it('merges the same console from both sources into one catalog', async () => {
    const [vimm, romsfun] = await Promise.all([
      fetchList(
        { systemCode: 'GB', regionId: '25', sort: 'Title', sortOrder: 'ASC', page: 1 },
        { userAgent: UA },
      ),
      fetchRomList(
        { systemCode: 'GB', regionId: '25', sort: 'Title', sortOrder: 'ASC', page: 1 },
        { userAgent: UA },
      ),
    ]);
    const rows = mergeSourceItems({ vimm: vimm.items, romsfun: romsfun.items });
    const both = rows.filter((r) => r.sources.vimm && r.sources.romsfun);
    const vimmOnly = rows.filter((r) => r.sources.vimm && !r.sources.romsfun);
    const rfOnly = rows.filter((r) => !r.sources.vimm && r.sources.romsfun);
    console.log(
      `[merge] ${vimm.items.length} vimm + ${romsfun.items.length} romsfun -> ${rows.length} rows ` +
        `(both=${both.length}, vimm-only=${vimmOnly.length}, romsfun-only=${rfOnly.length})`,
    );
    if (both.length > 0) console.log(`[merge] example matched: "${both[0].title}"`);

    // The merged catalog must never lose a game, and must never exceed the raw total.
    expect(rows.length).toBeLessThanOrEqual(vimm.items.length + romsfun.items.length);
    expect(rows.length).toBeGreaterThanOrEqual(
      Math.max(vimm.items.length, romsfun.items.length),
    );
    // Every row carries at least one source.
    expect(rows.every((r) => r.sources.vimm || r.sources.romsfun)).toBe(true);
  }, 120_000);
});
