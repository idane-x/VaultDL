import { contextBridge, ipcRenderer } from 'electron';
import type {
  DownloadProgress,
  GameDetail,
  GameMeta,
  ListPage,
  ListQuery,
  MetaLookup,
  PickFolderResult,
  QueueItem,
  Settings,
  VimmApi,
} from './shared/types.js';

/**
 * The single trusted bridge between renderer and main. Every method maps to an
 * ipcMain.handle(...) in services/ipc.ts; the two push channels ('progress',
 * 'queue-changed') map to webContents.send(...) there.
 */
const api: VimmApi = {
  getList: (query: ListQuery, force?: boolean) =>
    ipcRenderer.invoke('vault:getList', query, force) as Promise<ListPage>,
  getDetail: (vaultId, systemCode) =>
    ipcRenderer.invoke('vault:getDetail', vaultId, systemCode) as Promise<GameDetail>,

  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<Settings>,
  saveSettings: (patch) =>
    ipcRenderer.invoke('settings:save', patch) as Promise<Settings>,
  pickFolder: () => ipcRenderer.invoke('settings:pickFolder') as Promise<PickFolderResult>,
  resolveFolder: (systemCode) =>
    ipcRenderer.invoke('settings:resolveFolder', systemCode) as Promise<string>,
  openFolder: (p) => ipcRenderer.invoke('shell:openFolder', p) as Promise<void>,

  enqueue: (item) => ipcRenderer.invoke('queue:enqueue', item) as Promise<QueueItem>,
  getQueue: () => ipcRenderer.invoke('queue:get') as Promise<QueueItem[]>,
  pauseItem: (id) => ipcRenderer.invoke('queue:pause', id) as Promise<void>,
  resumeItem: (id) => ipcRenderer.invoke('queue:resume', id) as Promise<void>,
  cancelItem: (id) => ipcRenderer.invoke('queue:cancel', id) as Promise<void>,
  removeItem: (id) => ipcRenderer.invoke('queue:remove', id) as Promise<void>,
  clearFinished: () => ipcRenderer.invoke('queue:clearFinished') as Promise<void>,

  getGameMeta: (lookup: MetaLookup, withCandidates?: boolean) =>
    ipcRenderer.invoke('meta:get', lookup, withCandidates) as Promise<GameMeta>,
  overrideGameMeta: (lookup: MetaLookup, candidateId: string) =>
    ipcRenderer.invoke('meta:override', lookup, candidateId) as Promise<GameMeta>,

  onProgress: (cb: (p: DownloadProgress) => void) => {
    const listener = (_e: unknown, p: DownloadProgress) => cb(p);
    ipcRenderer.on('progress', listener);
    return () => ipcRenderer.removeListener('progress', listener);
  },
  onQueueChanged: (cb: (queue: QueueItem[]) => void) => {
    const listener = (_e: unknown, q: QueueItem[]) => cb(q);
    ipcRenderer.on('queue-changed', listener);
    return () => ipcRenderer.removeListener('queue-changed', listener);
  },
};

contextBridge.exposeInMainWorld('vimm', api);
