/**
 * SourceProvider adapter over the existing VimmClient — a thin wrapper so DownloadManager/ipc
 * only ever talk to the `SourceProvider` contract, never a site-specific client directly.
 *
 * `SourceRef` (shared/types.ts) carries no `systemCode` field by design — it's meant to stay
 * generic across sources. VimmClient.fetchDetail *takes* a systemCode parameter, but only
 * to stamp it onto the returned GameDetail for display; the actual page fetch and
 * `buildDownloadRequest` key purely off `vaultId`, so it has no effect on what gets
 * downloaded. VimmClient.parseList (edited alongside this file) stamps vimm rows with
 * `sourceRef: { source:'vimm', id: String(vaultId), variant: 0 }` — no consoleSlug. We pass
 * `ref.consoleSlug ?? ''` through here as a harmless placeholder; if a future caller needs
 * the browsed system to survive into GameDetail.systemCode, populate `ref.consoleSlug` at
 * the call site and it will flow through automatically.
 */
import { SYSTEMS } from '@shared/systems.js';
import type { ResolvedDownload, SourceProvider } from './types.js';
import * as VimmClient from '../VimmClient.js';

export const VimmProvider: SourceProvider = {
  id: 'vimm',

  supportsSystem(systemCode) {
    const system = SYSTEMS.find((s) => s.code === systemCode);
    return !!system?.sources.includes('vimm');
  },

  async fetchList(query, deps) {
    return VimmClient.fetchList(query, deps);
  },

  async resolveDownload(ref, deps): Promise<ResolvedDownload> {
    const vaultId = Number(ref.id);
    const altIndex = ref.variant ?? 0;
    const systemCode = ref.consoleSlug ?? '';

    const detail = await VimmClient.fetchDetail(vaultId, systemCode, deps);
    const { url, init } = VimmClient.buildDownloadRequest(detail, altIndex, deps.userAgent);
    const media = detail.media[altIndex] ?? detail.media[0];

    return {
      url,
      init,
      filename: media?.filename ?? `vault-${vaultId}`,
      sizeBytes: media?.sizeBytes ?? null,
      // Vimm's download host doesn't advertise Range support.
      supportsResume: false,
    };
  },
};
