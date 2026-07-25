/**
 * The contract every download source implements, so DownloadManager and the IPC layer
 * never import a site-specific client directly.
 *
 * Adding a source = implement this interface and register it in ./index.ts.
 */
import type { ListPage, ListQuery, SourceId, SourceRef } from '@shared/types.js';

export interface FetchDeps {
  userAgent: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** A concrete, ready-to-stream download request. */
export interface ResolvedDownload {
  url: string;
  init: RequestInit;
  /** Canonical filename as the source reports it (Content-Disposition may still win). */
  filename: string;
  sizeBytes: number | null;
  /**
   * True when the server accepts Range requests, so a partial `.part` file can resume
   * instead of restarting. (romsfun's CDN does; Vimm's does not advertise it.)
   */
  supportsResume?: boolean;
  /**
   * Set when the link points at a third-party file host (1fichier & co.) rather than a
   * direct file. Those hosts serve an HTML landing page gated by their own wait timer and
   * free-tier limits, so the app cannot — and deliberately does not try to — download them
   * automatically. The queue surfaces this and hands off to the user's browser instead.
   */
  external?: {
    host: string;
    /** The page to open in the browser so the user can complete the download there. */
    pageUrl: string;
  };
}

export interface SourceProvider {
  id: SourceId;

  /** Whether this provider can serve the given system code at all. */
  supportsSystem(systemCode: string): boolean;

  /**
   * One page of results for `query`. Providers that can't honour part of the query
   * (e.g. romsfun has no region concept) simply ignore that field rather than failing.
   */
  fetchList(query: ListQuery, deps: FetchDeps): Promise<ListPage>;

  /**
   * Resolve the concrete download URL. MUST be called at download time, not at enqueue:
   * romsfun's CDN links carry a token that expires after a few hours.
   */
  resolveDownload(ref: SourceRef, deps: FetchDeps): Promise<ResolvedDownload>;
}
