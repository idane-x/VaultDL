/**
 * DownloadManager — EventEmitter-based queue manager for vault downloads.
 *
 * Owns the ordered QueueItem[] the UI renders, a small scheduler that runs up to
 * `settings.concurrency` downloads at once, and the actual fetch-to-disk streaming
 * (with progress events, pause/resume/cancel via AbortController, retry-with-backoff,
 * and optional post-download extraction).
 *
 * Emits:
 *   'progress'      -> DownloadProgress, throttled to ~4/sec per active download
 *   'queue-changed' -> the full QueueItem[], on every state transition
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, statSync, rmSync } from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ReadableStream } from 'node:stream/web';
import type { DownloadProgress, QueueItem, SourceId, SourceRef } from '@shared/types.js';
import { getProvider } from './sources/index.js';
import { appFetch } from './appFetch.js';
import type { ResolvedDownload } from './sources/types.js';
import { ensureFolder } from './FolderResolver.js';
import { extractArchive } from './Extractor.js';
import { getSettings } from './SettingsStore.js';

/** Input accepted by enqueue() — mirrors VimmApi.enqueue's parameter shape. */
export interface EnqueueInput {
  source: SourceId;
  sourceRef: SourceRef;
  vaultId: number;
  systemCode: string;
  mediaId?: number;
  altIndex?: number;
  title: string;
  filename: string;
}

interface InternalState {
  controller: AbortController | null;
  retries: number;
  pauseRequested: boolean;
}

const PROGRESS_INTERVAL_MS = 250;
const MAX_RETRIES = 2;
const FINISHED_STATUSES: QueueItem['status'][] = ['done', 'failed', 'canceled'];

/** Extract the total size from a `Content-Range: bytes {start}-{end}/{total}` header. */
function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const m = /\/(\d+)\s*$/.exec(header.trim());
  return m ? Number(m[1]) : null;
}

class DownloadManagerImpl extends EventEmitter {
  private queue: QueueItem[] = [];
  private internal = new Map<string, InternalState>();
  private activeCount = 0;

  async enqueue(input: EnqueueInput): Promise<QueueItem> {
    const targetFolder = await ensureFolder(input.systemCode);

    const item: QueueItem = {
      id: randomUUID(),
      source: input.source,
      sourceRef: input.sourceRef,
      vaultId: input.vaultId,
      systemCode: input.systemCode,
      mediaId: input.mediaId,
      altIndex: input.altIndex,
      title: input.title,
      filename: input.filename,
      status: 'queued',
      progress: 0,
      receivedBytes: 0,
      totalBytes: null,
      speed: 0,
      targetFolder,
      error: null,
      addedAt: Date.now(),
    };

    this.queue.push(item);
    this.internal.set(item.id, { controller: null, retries: 0, pauseRequested: false });
    this.emitQueueChanged();
    this.schedule();
    return item;
  }

  getQueue(): QueueItem[] {
    return this.queue;
  }

  pause(id: string): void {
    const item = this.findItem(id);
    const state = this.internal.get(id);
    if (!item || !state || item.status !== 'downloading') return;
    state.pauseRequested = true;
    state.controller?.abort();
  }

  resume(id: string): void {
    const item = this.findItem(id);
    const state = this.internal.get(id);
    if (!item || !state) return;
    if (item.status !== 'paused' && item.status !== 'failed') return;

    state.pauseRequested = false;
    item.status = 'queued';
    item.error = null;
    this.emitQueueChanged();
    this.schedule();
  }

  cancel(id: string): void {
    const item = this.findItem(id);
    const state = this.internal.get(id);
    if (!item) return;

    state?.controller?.abort();
    item.status = 'canceled';
    item.error = null;
    this.cleanupTemp(id);
    this.emitQueueChanged();
    this.schedule();
  }

  remove(id: string): void {
    const item = this.findItem(id);
    if (!item) return;

    if (item.status === 'downloading' || item.status === 'queued') {
      this.cancel(id);
    }
    this.queue = this.queue.filter((q) => q.id !== id);
    this.internal.delete(id);
    this.emitQueueChanged();
  }

  clearFinished(): void {
    const keepIds = new Set<string>();
    this.queue = this.queue.filter((q) => {
      const keep = !FINISHED_STATUSES.includes(q.status);
      if (keep) keepIds.add(q.id);
      return keep;
    });
    for (const id of this.internal.keys()) {
      if (!keepIds.has(id)) this.internal.delete(id);
    }
    this.emitQueueChanged();
  }

  // -- internals -------------------------------------------------------------

  private findItem(id: string): QueueItem | undefined {
    return this.queue.find((q) => q.id === id);
  }

  private tempPath(id: string): string {
    return path.join(os.tmpdir(), `vimm-${id}.part`);
  }

  private cleanupTemp(id: string): void {
    try {
      rmSync(this.tempPath(id), { force: true });
    } catch {
      // best-effort
    }
  }

  private emitQueueChanged(): void {
    this.emit('queue-changed', this.getQueue());
  }

  private emitProgress(p: DownloadProgress): void {
    this.emit('progress', p);
  }

  private schedule(): void {
    const settings = getSettings();
    const concurrency = Math.max(1, settings.concurrency || 1);

    while (this.activeCount < concurrency) {
      const next = this.queue.find((q) => q.status === 'queued');
      if (!next) break;

      this.activeCount += 1;
      void this.runDownload(next.id).finally(() => {
        this.activeCount -= 1;
        this.schedule();
      });
    }
  }

  private async runDownload(id: string): Promise<void> {
    const item = this.findItem(id);
    const state = this.internal.get(id);
    if (!item || !state) return;

    item.status = 'downloading';
    item.error = null;
    item.speed = 0;
    this.emitQueueChanged();

    const settings = getSettings();
    const controller = new AbortController();
    state.controller = controller;

    try {
      // Resolve INSIDE runDownload, never at enqueue time: romsfun CDN links carry a token
      // that expires after a few hours, so an item that has been sitting in the queue must
      // get a freshly-resolved URL right before it actually starts streaming, not whatever
      // was valid back when it was queued.
      const resolved: ResolvedDownload = await getProvider(item.source).resolveDownload(
        item.sourceRef,
        { userAgent: settings.userAgent, fetchImpl: appFetch },
      );

      // Some titles (notably PS4 ISOs) aren't on the source's own CDN — they're parked on a
      // third-party host that serves an HTML landing page behind its own wait timer and
      // free-tier limits. Driving that gate would mean automating around a deliberate access
      // control, so we stop here and hand the user a link to finish it in their browser.
      if (resolved.external) {
        item.externalUrl = resolved.external.pageUrl;
        throw new Error(
          `Hosted on ${resolved.external.host}, not a direct link. Open it in your browser to download.`,
        );
      }

      const tempFile = this.tempPath(id);
      let existingSize = 0;
      if (resolved.supportsResume && existsSync(tempFile)) {
        try {
          existingSize = statSync(tempFile).size;
        } catch {
          existingSize = 0;
        }
      }

      const headers = new Headers(resolved.init.headers);
      if (existingSize > 0) {
        headers.set('Range', `bytes=${existingSize}-`);
      }

      // appFetch (Chromium's stack) rather than Node's fetch: romsfun's CDN sits behind the
      // same Cloudflare TLS fingerprinting that blocks undici outright.
      const res = await appFetch(resolved.url, {
        ...resolved.init,
        headers,
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`Download failed: HTTP ${res.status}`);
      }

      // A Range request only actually resumes when the server answers 206. A 200 means it
      // ignored Range entirely, so the response body is the full file again — truncate and
      // start over rather than appending a full copy after the partial bytes we already had.
      const isResuming = existingSize > 0 && res.status === 206;
      const startBytes = isResuming ? existingSize : 0;

      item.filename = this.resolveFilename(res, resolved);

      if (isResuming) {
        const rangeTotal = parseContentRangeTotal(res.headers.get('content-range'));
        item.totalBytes = rangeTotal ?? resolved.sizeBytes ?? null;
      } else {
        const totalHeader = res.headers.get('content-length');
        item.totalBytes = totalHeader ? Number(totalHeader) : (resolved.sizeBytes ?? null);
      }

      await this.streamToFile(
        res.body as ReadableStream<Uint8Array>,
        tempFile,
        item,
        controller.signal,
        startBytes,
        isResuming,
      );

      const destPath = path.join(item.targetFolder, item.filename);
      await this.moveFile(tempFile, destPath);

      if (settings.autoExtract && /\.(zip|7z)$/i.test(item.filename)) {
        item.status = 'extracting';
        item.progress = 1;
        this.emitQueueChanged();

        await extractArchive(destPath, item.targetFolder);
        if (!settings.keepArchive) {
          await fsp.rm(destPath, { force: true });
        }
      }

      item.status = 'done';
      item.progress = 1;
      item.speed = 0;
      this.emitQueueChanged();
    } catch (err) {
      if (controller.signal.aborted) {
        if (state.pauseRequested) {
          // Deliberately keep the `.part` file on disk: resume() re-enters runDownload,
          // which re-checks resolved.supportsResume and, if true, Range-requests from
          // exactly this file's current size instead of restarting the whole download.
          item.status = 'paused';
          state.pauseRequested = false;
        } else if ((item.status as QueueItem['status']) !== 'canceled') {
          // `item.status` can be mutated concurrently by cancel() while this await was
          // pending; TS's control-flow narrowing doesn't know that, hence the cast.
          item.status = 'canceled';
          this.cleanupTemp(id);
        } else {
          // Reached via cancel()'s own abort(); cancel() already cleaned up the temp file.
        }
        this.emitQueueChanged();
        return;
      }

      const message = err instanceof Error ? err.message : String(err);

      if (state.retries < MAX_RETRIES && this.isRetryable(err)) {
        state.retries += 1;
        // Keep the `.part` file: most retryable failures are mid-stream network blips, and
        // the next attempt will Range-resume from it when the source supports resume (and
        // safely truncate-and-restart via the non-append write path when it doesn't).
        const attempt = state.retries;
        // Deliberately leave status as 'downloading' during the backoff wait so a
        // concurrent scheduler tick (concurrency > 1) can't pick this id up a second
        // time before this run actually finishes. Flip to 'queued' right at the end,
        // then let the scheduler's post-run `schedule()` call pick it up.
        item.error = `Retrying (${attempt}/${MAX_RETRIES}): ${message}`;
        this.emitQueueChanged();
        await this.delay(1000 * 2 ** (attempt - 1));
        item.status = 'queued';
        this.emitQueueChanged();
        return;
      }

      item.status = 'failed';
      item.error = message;
      this.cleanupTemp(id);
      this.emitQueueChanged();
    } finally {
      state.controller = null;
    }
  }

  private isRetryable(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return /network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|HTTP 5\d\d/i.test(
      err.message,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveFilename(res: Response, resolved: ResolvedDownload): string {
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      if (match?.[1]) {
        try {
          return path.basename(decodeURIComponent(match[1]));
        } catch {
          return path.basename(match[1]);
        }
      }
    }

    const base = path.basename(resolved.filename);
    return /\.[^./\\]+$/.test(base) ? base : `${base}.zip`;
  }

  private async streamToFile(
    body: ReadableStream<Uint8Array>,
    destPath: string,
    item: QueueItem,
    signal: AbortSignal,
    startBytes: number,
    append: boolean,
  ): Promise<void> {
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    // Append when resuming a partial `.part` file the server accepted a Range request for;
    // otherwise ('w') truncate and start clean, covering both the plain first-attempt case
    // and the "server ignored our Range header" fallback.
    const writable = createWriteStream(destPath, { flags: append ? 'a' : 'w' });
    const reader = body.getReader();

    let received = startBytes;
    let lastEmit = 0;
    let lastBytes = received;
    let lastTime = Date.now();

    item.receivedBytes = received;
    item.progress = item.totalBytes ? Math.min(1, received / item.totalBytes) : item.progress;

    try {
      for (;;) {
        if (signal.aborted) throw new Error('aborted');

        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        received += value.byteLength;
        await new Promise<void>((resolve, reject) => {
          writable.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
        });

        const now = Date.now();
        if (now - lastEmit >= PROGRESS_INTERVAL_MS) {
          const dtSec = (now - lastTime) / 1000;
          const instSpeed = dtSec > 0 ? (received - lastBytes) / dtSec : 0;
          item.speed = item.speed > 0 ? item.speed * 0.7 + instSpeed * 0.3 : instSpeed;
          item.receivedBytes = received;
          item.progress = item.totalBytes ? Math.min(1, received / item.totalBytes) : 0;

          lastEmit = now;
          lastBytes = received;
          lastTime = now;

          this.emitProgress({
            id: item.id,
            status: item.status,
            progress: item.progress,
            receivedBytes: item.receivedBytes,
            totalBytes: item.totalBytes,
            speed: item.speed,
          });
        }
      }

      item.receivedBytes = received;
      item.progress = item.totalBytes ? Math.min(1, received / item.totalBytes) : item.progress;
    } finally {
      await new Promise<void>((resolve) => writable.end(() => resolve()));
    }
  }

  private async moveFile(src: string, dest: string): Promise<void> {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fsp.rename(src, dest);
    } catch {
      // Cross-device (e.g. temp dir on a different drive than the target folder).
      await fsp.copyFile(src, dest);
      await fsp.rm(src, { force: true });
    }
  }
}

export const downloadManager = new DownloadManagerImpl();
