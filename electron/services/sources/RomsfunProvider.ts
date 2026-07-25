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
    const { url, filename, sizeBytes, refererUsed } = await fetchDownloadTarget(ref, deps);
    return {
      url,
      init: {
        method: 'GET',
        headers: {
          'User-Agent': deps.userAgent,
          Referer: refererUsed,
        },
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
