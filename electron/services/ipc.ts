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
import type {
  DownloadProgress,
  GameDetail,
  GameListItem,
  PickFolderResult,
  QueueItem,
  Settings,
} from '@shared/types.js';
import { fetchDetail, fetchListing } from './VimmClient.js';
import { getSettings, saveSettings } from './SettingsStore.js';
import { cacheStore } from './CacheStore.js';
import { resolveFolder } from './FolderResolver.js';
import { downloadManager, type EnqueueInput } from './DownloadManager.js';

let currentWindow: BrowserWindow | null = null;
let handlersRegistered = false;

function send(channel: string, payload: unknown): void {
  if (currentWindow && !currentWindow.isDestroyed()) {
    currentWindow.webContents.send(channel, payload);
  }
}

export function registerIpcHandlers(win: BrowserWindow): void {
  currentWindow = win;
  if (handlersRegistered) return;
  handlersRegistered = true;

  downloadManager.on('progress', (p: DownloadProgress) => send('progress', p));
  downloadManager.on('queue-changed', (q: QueueItem[]) => send('queue-changed', q));

  // -- Vault browsing --------------------------------------------------------

  ipcMain.handle(
    'vault:getListing',
    async (_e, systemCode: string, letter: string, force?: boolean): Promise<GameListItem[]> => {
      const key = `${systemCode}/${letter}`;
      if (!force) {
        const cached = cacheStore.get(key);
        if (cached) return cached;
      }
      const items = await fetchListing(systemCode, letter, { userAgent: getSettings().userAgent });
      cacheStore.set(key, items);
      return items;
    },
  );

  ipcMain.handle(
    'vault:getDetail',
    async (_e, vaultId: number, systemCode: string): Promise<GameDetail> =>
      fetchDetail(vaultId, systemCode, { userAgent: getSettings().userAgent }),
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
}
