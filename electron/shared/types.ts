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

// ---------------------------------------------------------------------------
// Metadata (box art from TheGamesDB, Metacritic score from RAWG)
// ---------------------------------------------------------------------------

export type MetaStatus = 'ok' | 'no-match' | 'no-key' | 'error' | 'loading';

/** An alternative provider match, offered when the auto-pick looks wrong. */
export interface MetaCandidate {
  /** Provider-native game id (stringified). */
  id: string;
  title: string;
  year: string | null;
  /** Small preview image, served through the artcache: protocol when cached. */
  thumbUrl: string | null;
}

/** Resolved metadata for one vault game, combining art + score providers. */
export interface GameMeta {
  vaultId: number;
  systemCode: string;
  /** The provider title we matched against (for transparency / debugging). */
  matchedTitle: string | null;
  /**
   * Front box-art URL. When cached to disk it is an `artcache://…` URL the renderer
   * can put straight in an <img src>; null when unmatched or art unavailable.
   */
  boxArtUrl: string | null;
  /** Metacritic score (0–100) from RAWG, or null if none. */
  metascore: number | null;
  /** Release date/year enriched from a provider, if found. */
  releaseDate: string | null;
  status: MetaStatus;
  /** Populated on request so the UI can offer a manual re-match. */
  candidates?: MetaCandidate[];
}

/** Identifies a game to look metadata up for. */
export interface MetaLookup {
  vaultId: number;
  systemCode: string;
  title: string;
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
  /** Master toggle for fetching box art + scores. */
  metadataEnabled: boolean;
  /** TheGamesDB API key (box art). Empty/null disables art lookups. */
  tgdbApiKey: string | null;
  /** RAWG API key (Metacritic score). Empty/null disables score lookups. */
  rawgApiKey: string | null;
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
  metadataEnabled: true,
  tgdbApiKey: null,
  rawgApiKey: null,
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

  /**
   * Resolve box art + score for a game. Cheap to call repeatedly — results are cached
   * in the main process (memory + disk). Returns status 'no-key' when the relevant API
   * key is unset. `withCandidates` requests the alternative-match list for the override UI.
   */
  getGameMeta(lookup: MetaLookup, withCandidates?: boolean): Promise<GameMeta>;
  /** Re-point a game's art match at a specific TheGamesDB candidate id and re-cache. */
  overrideGameMeta(lookup: MetaLookup, candidateId: string): Promise<GameMeta>;

  /** Subscribe to progress pushes; returns an unsubscribe fn. */
  onProgress(cb: (p: DownloadProgress) => void): () => void;
  onQueueChanged(cb: (queue: QueueItem[]) => void): () => void;
}

declare global {
  interface Window {
    vimm: VimmApi;
  }
}
