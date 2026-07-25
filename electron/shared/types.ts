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

/** Which site a row / download came from. */
export type SourceId = 'vimm' | 'romsfun';

export const SOURCE_LABELS: Record<SourceId, string> = {
  vimm: "Vimm's Lair",
  romsfun: 'RomsFun',
};

/**
 * Everything a provider needs to re-resolve a download later. Kept deliberately generic
 * so neither source's identifiers leak into shared code:
 *  - vimm:    { id: String(vaultId) }
 *  - romsfun: { id: String(postId), slug, consoleSlug }
 *
 * romsfun CDN links carry a token that expires after a few hours, so the concrete URL is
 * resolved at download time from this ref — never cached.
 */
export interface SourceRef {
  source: SourceId;
  id: string;
  slug?: string;
  consoleSlug?: string;
  /** Index of the download variant on the source's page (romsfun `/download/{slug}-{id}/{n}`). */
  variant?: number;
}

/** One row from a source's listing (Vimm advanced-list table, or romsfun's REST API). */
export interface GameListItem {
  /**
   * Vimm vault page id. Retained for Vimm rows (and metadata cache keys); romsfun rows
   * set this to 0 and carry their identity in `sourceRef`.
   */
  vaultId: number;
  /** Which site this row came from. */
  source: SourceId;
  /** Everything needed to resolve this row's download later. */
  sourceRef: SourceRef;
  title: string;
  /**
   * The system this row belongs to. In browse mode it's the browsed system; in global
   * search it's parsed from the results table's System column (which holds the code).
   * Used for downloading (folder routing) and metadata lookups.
   */
  systemCode: string | null;
  regions: Region[];
  version: string | null;
  languages: string[];
  /** Rating text as shown ("none", a number, etc.) — kept as string, site-defined. */
  rating: string | null;
  /** File size text if the listing exposes it (varies by console), else null. */
  sizeText: string | null;
  serial: string | null;
  /** Marked with the site's "Unlicensed" badge. */
  unlicensed: boolean;
  /** Release/dump date, filled in lazily once the detail page is fetched. */
  releaseDate: string | null;
}

/** Sort order accepted by the advanced list. */
export type SortOrder = 'ASC' | 'DESC';

/**
 * A query against Vimm's advanced list endpoint
 * (`/vault/?p=list&mode=adv&…`). `region` is REQUIRED by the site — an empty region 404s,
 * so there is no single "all regions" request; the UI exposes a region picker instead.
 * Provide `systemCode` to browse one console, OR `q` (>=3 chars, systemCode omitted) to
 * search across all consoles.
 */
export interface ListQuery {
  systemCode?: string | null;
  q?: string | null;
  /**
   * Numeric Vimm region id as a string, e.g. '25' = USA. Applies to Vimm ONLY — romsfun
   * has no region concept (region is just text inside the title), so its rows come back
   * unfiltered rather than being silently dropped.
   */
  regionId: string;
  /** Sort field, e.g. 'Title' | 'Year' | 'Rating' | 'Size' | 'System'. */
  sort: string;
  sortOrder: SortOrder;
  /** 1-based page number. */
  page: number;
  /** Which sources to query. Defaults to every enabled source. */
  sources?: SourceId[];
}

/** One page of results from a SINGLE source. */
export interface ListPage {
  items: GameListItem[];
  page: number;
  /** True when a next page exists (a further `page=` link / page number is available). */
  hasMore: boolean;
  /** True when this was a cross-system search (rows carry their own systemCode). */
  isSearch: boolean;
}

/**
 * One row of the merged catalog: the same game as offered by one or both sources.
 * Rows only merge when the normalized titles match strongly AND the system agrees —
 * when in doubt they stay separate, because a duplicate row is a far better failure
 * than downloading the wrong game.
 */
export interface MergedRow {
  /** Stable identity for React keys, queue lookups and metadata caching. */
  key: string;
  /** Display title (taken from the first source that has the row). */
  title: string;
  systemCode: string | null;
  regions: Region[];
  version: string | null;
  languages: string[];
  rating: string | null;
  sizeText: string | null;
  unlicensed: boolean;
  releaseDate: string | null;
  /** The per-source rows backing this entry; a missing key means that source lacks it. */
  sources: Partial<Record<SourceId, GameListItem>>;
}

/** One page of the merged catalog, tracking each source's pagination independently. */
export interface MergedPage {
  rows: MergedRow[];
  page: number;
  /** Per-source "another page exists" flags; the UI loads more while any is true. */
  hasMore: Partial<Record<SourceId, boolean>>;
  isSearch: boolean;
  /** Sources that failed this request (surfaced in the UI without killing the whole list). */
  errors?: Partial<Record<SourceId, string>>;
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
  /** Which site this download comes from. */
  source: SourceId;
  /** Everything needed to (re-)resolve the concrete download URL at start time. */
  sourceRef: SourceRef;
  /** Vimm vault id; 0 for rows that came from another source. */
  vaultId: number;
  systemCode: string;
  /** Vimm-only: the media id POSTed to the download host. */
  mediaId?: number;
  /** Vimm-only: disc/format index into GameDetail.media that was chosen. */
  altIndex?: number;
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
  /**
   * Set when the source parked this title on a gated third-party host (1fichier & co.)
   * instead of a direct link. The queue offers "Open in browser" so the user can complete
   * it there — the app deliberately doesn't automate those hosts' wait timers/limits.
   */
  externalUrl?: string | null;
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
  /** Per-source enable toggles; a disabled source is never queried and shows no column. */
  enabledSources: Record<SourceId, boolean>;
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
  enabledSources: { vimm: true, romsfun: true },
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
  /**
   * Fetch one page of the advanced list — browse a console (`query.systemCode`) or search
   * across all of them (`query.q`). See ListQuery. Cached per full query in main.
   */
  getList(query: ListQuery, force?: boolean): Promise<MergedPage>;
  getDetail(vaultId: number, systemCode: string): Promise<GameDetail>;

  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  pickFolder(): Promise<PickFolderResult>;
  /** Resolve the effective output folder for a system code. */
  resolveFolder(systemCode: string): Promise<string>;
  openFolder(path: string): Promise<void>;
  /** Open a URL in the user's default browser (used for gated third-party file hosts). */
  openExternal(url: string): Promise<void>;

  /**
   * Queue a download from a specific source. `sourceRef` carries whatever that provider
   * needs to resolve the concrete URL when the download actually starts.
   */
  enqueue(item: {
    source: SourceId;
    sourceRef: SourceRef;
    vaultId: number;
    systemCode: string;
    mediaId?: number;
    altIndex?: number;
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
