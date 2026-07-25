/**
 * SourceProvider adapter over RomsfunClient — the only file DownloadManager/ipc should ever
 * import to talk to romsfun. Keeps the client itself free of the shared `SourceProvider`
 * contract so it stays trivially unit-testable against fixtures.
 */
import { SYSTEMS } from '@shared/systems.js';
import type { FetchDeps, ResolvedDownload, SourceProvider } from './types.js';
import { fetchDownloadTarget, fetchRomList } from './RomsfunClient.js';

export const RomsfunProvider: SourceProvider = {
  id: 'romsfun',

  supportsSystem(systemCode) {
    const system = SYSTEMS.find((s) => s.code === systemCode);
    return !!system?.romsfun;
  },

  async fetchList(query, deps: FetchDeps) {
    return fetchRomList(query, deps);
  },

  async resolveDownload(ref, deps: FetchDeps): Promise<ResolvedDownload> {
    const { url, filename, sizeBytes, refererUsed, externalHost } = await fetchDownloadTarget(
      ref,
      deps,
    );
    return {
      url,
      // Large titles (PS4 ISOs) are offloaded to gated file hosts rather than romsfun's own
      // CDN. Flag it so the queue can hand off to the browser instead of failing cryptically.
      ...(externalHost ? { external: { host: externalHost, pageUrl: refererUsed } } : {}),
      init: {
        method: 'GET',
        headers: { 'User-Agent': deps.userAgent },
        // Deliberately NOT a `Referer` header. The CDN is a different origin from
        // romsfun.com, and Chromium rejects a cross-origin Referer header outright
        // (ERR_BLOCKED_BY_CLIENT) — which would push the request onto Node's stack and
        // straight into Cloudflare's 403. Verified live: the CDN serves the file with no
        // referer at all; the `?token=` in the URL is what authorises it. The referrer
        // hint below is the spec-compliant form, which Chromium is happy to send.
        referrer: refererUsed,
      },
      // Falls back to the slug if the page's "You are downloading" heading was ever
      // missing — resolveDownload should never throw on a missing filename, only on a
      // genuinely missing download link (handled inside parseDownloadPage).
      filename: filename ?? ref.slug ?? `romsfun-${ref.id}`,
      sizeBytes,
      // Verified live: the CDN responds with `Accept-Ranges: bytes`.
      supportsResume: true,
    };
  },
};
