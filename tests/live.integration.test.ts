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
  fetchListing,
  fetchDetail,
  buildDownloadRequest,
} from '../electron/services/VimmClient.js';
import { extractArchive } from '../electron/services/Extractor.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

live('LIVE vimm.net end-to-end', () => {
  it('lists → details → downloads → extracts a small NES ROM', async () => {
    // 1. Listing
    const items = await fetchListing('NES', 'A', { userAgent: UA });
    console.log(`[listing] NES/A returned ${items.length} games`);
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
