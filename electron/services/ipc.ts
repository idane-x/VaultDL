/**
 * ipc.ts — registers every ipcMain.handle channel the preload bridge (electron/preload.ts)
 * invokes, and wires DownloadManager's events to the renderer via webContents.send.
 *
 * registerIpcHandlers() is called once at startup and again from main.ts's 'activate'
 * handler (macOS-style re-create-window flow). ipcMain.handle throws if a channel is
 * registered twice, so the actual `ipcMain.handle(...)` calls are guarded to run once;
 * only the "which window do pushes go to" reference is updated on subsequent calls.
 */
import { type BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { appFetch } from './appFetch.js';
import type {
  DownloadProgress,
  GameDetail,
  GameListItem,
  GameMeta,
  ListQuery,
  MergedPage,
  MetaLookup,
  PickFolderResult,
  QueueItem,
  Settings,
  SourceId,
} from '@shared/types.js';
import { fetchDetail } from './VimmClient.js';
import { getSettings, saveSettings } from './SettingsStore.js';
import { cacheStore } from './CacheStore.js';
import { resolveFolder } from './FolderResolver.js';
import { downloadManager, type EnqueueInput } from './DownloadManager.js';
import { MetadataService } from './MetadataService.js';
import { providersForSystem, allProviders } from './sources/index.js';
import { mergeSourceItems } from './merge.js';

let currentWindow: BrowserWindow | null = null;
let handlersRegistered = false;

function send(channel: string, payload: unknown): void {
  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.webContents.send(channel, payload);
  }
}

/**
 * Build a total (every SourceId present) enabled map for this request: `query.sources`,
 * when given, is an explicit allowlist (everything else off); otherwise fall back to the
 * user's `enabledSources` setting as-is.
 */
function enabledMapFor(query: ListQuery, settings: Settings): Record<SourceId, boolean> {
  if (!query.sources || query.sources.length === 0) return settings.enabledSources;
  const allowed = new Set(query.sources);
  const result = {} as Record<SourceId, boolean>;
  for (const id of Object.keys(settings.enabledSources) as SourceId[]) {
    result[id] = allowed.has(id);
  }
  return result;
}

export function registerIpcHandlers(win: BrowserWindow): void {
  currentWindow = win;
  if (handlersRegistered) return;
  handlersRegistered = true;

  downloadManager.on('progress', (p: DownloadProgress) => send('progress', p));
  downloadManager.on('queue-changed', (q: QueueItem[]) => send('queue-changed', q));

  // -- Vault browsing --------------------------------------------------------

  ipcMain.handle(
    'vault:getList',
    async (_e, query: ListQuery, force?: boolean): Promise<MergedPage> => {
      // The cache key already JSON-stringifies the full query, so `sources` partitions the
      // cache automatically — no extra keying needed.
      const key = `list:${JSON.stringify(query)}`;
      if (!force) {
        const cached = cacheStore.get(key);
        if (cached) return cached;
      }

      const settings = getSettings();
      const enabled = enabledMapFor(query, settings);
      const providers = query.systemCode
        ? providersForSystem(query.systemCode, enabled)
        : allProviders().filter((p) => enabled[p.id]);

      const settled = await Promise.allSettled(
        providers.map((p) =>
          p.fetchList(query, { userAgent: settings.userAgent, fetchImpl: appFetch }),
        ),
      );

      const lists: Partial<Record<SourceId, GameListItem[]>> = {};
      const hasMore: Partial<Record<SourceId, boolean>> = {};
      const errors: Partial<Record<SourceId, string>> = {};
      let isSearch = false;

      settled.forEach((result, i) => {
        const source = providers[i].id;
        if (result.status === 'fulfilled') {
          lists[source] = result.value.items;
          hasMore[source] = result.value.hasMore;
          isSearch = isSearch || result.value.isSearch;
        } else {
          // A failing source must not kill the whole list — surface it per-source instead.
          const reason = result.reason;
          errors[source] = reason instanceof Error ? reason.message : String(reason);
        }
      });

      const page: MergedPage = {
        rows: mergeSourceItems(lists),
        page: query.page,
        hasMore,
        isSearch,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      };

      cacheStore.set(key, page);
      return page;
    },
  );

  ipcMain.handle(
    'vault:getDetail',
    async (_e, vaultId: number, systemCode: string): Promise<GameDetail> =>
      fetchDetail(vaultId, systemCode, {
        userAgent: getSettings().userAgent,
        fetchImpl: appFetch,
      }),
  );

  // -- Settings ----------------------------------------------------------------

  ipcMain.handle('settings:get', async (): Promise<Settings> => getSettings());

  ipcMain.handle(
    'settings:save',
    async (_e, patch: Partial<Settings>): Promise<Settings> => saveSettings(patch),
  );

  ipcMain.handle('settings:pickFolder', async (): Promise<PickFolderResult> => {
    if (!currentWindow) return { canceled: true, path: null };
    const result = await dialog.showOpenDialog(currentWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, path: null };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(
    'settings:resolveFolder',
    async (_e, systemCode: string): Promise<string> => resolveFolder(systemCode),
  );

  ipcMain.handle('shell:openFolder', async (_e, targetPath: string): Promise<void> => {
    const err = await shell.openPath(targetPath);
    if (err) throw new Error(err);
  });

  ipcMain.handle('shell:openExternal', async (_e, url: string): Promise<void> => {
    // Only ever hand http(s) links to the OS — never a file:// or custom scheme.
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Refusing to open non-web URL: ${parsed.protocol}`);
    }
    await shell.openExternal(url);
  });

  // -- Download queue ------------------------------------------------------

  ipcMain.handle(
    'queue:enqueue',
    async (_e, item: EnqueueInput): Promise<QueueItem> => downloadManager.enqueue(item),
  );

  ipcMain.handle('queue:get', async (): Promise<QueueItem[]> => downloadManager.getQueue());

  ipcMain.handle('queue:pause', async (_e, id: string): Promise<void> => {
    downloadManager.pause(id);
  });

  ipcMain.handle('queue:resume', async (_e, id: string): Promise<void> => {
    downloadManager.resume(id);
  });

  ipcMain.handle('queue:cancel', async (_e, id: string): Promise<void> => {
    downloadManager.cancel(id);
  });

  ipcMain.handle('queue:remove', async (_e, id: string): Promise<void> => {
    downloadManager.remove(id);
  });

  ipcMain.handle('queue:clearFinished', async (): Promise<void> => {
    downloadManager.clearFinished();
  });

  // -- Metadata (box art + Metacritic score) --------------------------------

  ipcMain.handle(
    'meta:get',
    async (_e, lookup: MetaLookup, withCandidates?: boolean): Promise<GameMeta> =>
      MetadataService.getMeta(lookup, withCandidates),
  );

  ipcMain.handle(
    'meta:override',
    async (_e, lookup: MetaLookup, candidateId: string): Promise<GameMeta> =>
      MetadataService.overrideMeta(lookup, candidateId),
  );
}
