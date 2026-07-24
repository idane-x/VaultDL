/**
 * Shared type contracts between the Electron main process and the React renderer.
 * The renderer only ever touches these types (via the preload bridge) — never Node APIs.
 */

export type Region =
  | 'USA'
  | 'Europe'
  | 'Japan'
  | 'Asia'
  | 'Australia'
  | 'Korea'
  | 'China'
  | 'Brazil'
  | 'World'
  | 'Other';

/** One row parsed from a /vault/{code}/{letter} listing table. */
export interface GameListItem {
  /** The vault page id (path segment in /vault/{id}). NOTE: not the download mediaId. */
  vaultId: number;
  title: string;
  regions: Region[];
  version: string | null;
  languages: string[];
  /** Rating text as shown ("none", a number, etc.) — kept as string, site-defined. */
  rating: string | null;
  /** File size text if the listing exposes it (varies by console), else null. */
  sizeText: string | null;
  serial: string | null;
  /** Release/dump date, filled in lazily once the detail page is fetched. */
  releaseDate: string | null;
}

/** A downloadable media entry from the detail page's embedded `media` JSON blob. */
export interface MediaEntry {
  /** The value POSTed as `mediaId` — this is what the download server keys on. */
  mediaId: number;
  /** Decoded canonical ROM filename (from base64 GoodTitle). */
  filename: string;
  version: string | null;
  serial: string | null;
  sizeText: string | null;
  sizeBytes: number | null;
  /** disc ordering for multi-disc titles (SortOrder). */
  sortOrder: number;
  releaseDate: string | null;
  crc: string | null;
  md5: string | null;
  sha1: string | null;
}

/** Full detail for a vault page, including everything needed to download. */
export interface GameDetail {
  vaultId: number;
  systemCode: string;
  title: string;
  regions: Region[];
  /** Absolute download endpoint parsed from the page's <form id="dl_form" action>. */
  downloadAction: string;
  /** One entry per disc/media; index 0 is the default. */
  media: MediaEntry[];
}

export type QueueStatus =
  | 'queued'
  | 'downloading'
  | 'extracting'
  | 'done'
  | 'failed'
  | 'paused'
  | 'canceled';

/** A queued/active/finished download as the UI sees it. */
export interface QueueItem {
  id: string;
  vaultId: number;
  systemCode: string;
  mediaId: number;
  /** disc/format index into GameDetail.media that was chosen. */
  altIndex: number;
  title: string;
  filename: string;
  status: QueueStatus;
  /** 0..1 */
  progress: number;
  receivedBytes: number;
  totalBytes: number | null;
  /** bytes/sec, smoothed. */
  speed: number;
  /** Final resolved output folder for this platform. */
  targetFolder: string;
  error: string | null;
  addedAt: number;
}

/** Progress event pushed from main -> renderer during a download. */
export interface DownloadProgress {
  id: string;
  status: QueueStatus;
  progress: number;
  receivedBytes: number;
  totalBytes: number | null;
  speed: number;
  error?: string | null;
}

export interface Settings {
  /** Root of an EmuDeck-style layout; targets compose as {root}/roms/{emudeck}. */
  emudeckRoot: string | null;
  /** Per-system absolute folder overrides, keyed by system code. */
  perSystemFolders: Record<string, string>;
  /** Concurrent downloads (1 keeps us a polite single-session client). */
  concurrency: number;
  /** Delete the archive after successful extraction. */
  autoExtract: boolean;
  keepArchive: boolean;
  userAgent: string;
  /** Listing cache time-to-live in minutes. */
  cacheTtlMinutes: number;
  firstRunAcknowledged: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  emudeckRoot: null,
  perSystemFolders: {},
  concurrency: 1,
  autoExtract: true,
  keepArchive: false,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  cacheTtlMinutes: 720,
  firstRunAcknowledged: false,
};

/** Result of a folder-picker dialog. */
export interface PickFolderResult {
  canceled: boolean;
  path: string | null;
}

/**
 * The typed API exposed on window.vimm by the preload bridge.
 * Keep this in lockstep with electron/preload.ts and the ipc handlers in main.ts.
 */
export interface VimmApi {
  getListing(systemCode: string, letter: string, force?: boolean): Promise<GameListItem[]>;
  getDetail(vaultId: number, systemCode: string): Promise<GameDetail>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  pickFolder(): Promise<PickFolderResult>;
  /** Resolve the effective output folder for a system code. */
  resolveFolder(systemCode: string): Promise<string>;
  openFolder(path: string): Promise<void>;

  enqueue(item: {
    vaultId: number;
    systemCode: string;
    mediaId: number;
    altIndex: number;
    title: string;
    filename: string;
  }): Promise<QueueItem>;
  getQueue(): Promise<QueueItem[]>;
  pauseItem(id: string): Promise<void>;
  resumeItem(id: string): Promise<void>;
  cancelItem(id: string): Promise<void>;
  removeItem(id: string): Promise<void>;
  clearFinished(): Promise<void>;

  /** Subscribe to progress pushes; returns an unsubscribe fn. */
  onProgress(cb: (p: DownloadProgress) => void): () => void;
  onQueueChanged(cb: (queue: QueueItem[]) => void): () => void;
}

declare global {
  interface Window {
    vimm: VimmApi;
  }
}
