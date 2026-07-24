/**
 * Shared contract for the custom `artcache://` protocol that serves cached box-art files
 * to the renderer (whose CSP allows `artcache:` in img-src). No Electron imports here so
 * this stays importable from both the main process and the renderer.
 *
 * URL shape:  artcache://img/<relPath>   e.g.  artcache://img/tgdb/12345.jpg
 * where <relPath> is relative to the on-disk art cache directory (resolved in main via
 * app.getPath('userData')/artcache).
 */
export const ARTCACHE_SCHEME = 'artcache';
const PREFIX = `${ARTCACHE_SCHEME}://img/`;

/** Build the renderer-usable URL for a file at `relPath` inside the art cache dir. */
export function artcacheUrl(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  return PREFIX + normalized.split('/').map(encodeURIComponent).join('/');
}

/** Extract the cache-relative path from an artcache URL, or null if it isn't one. */
export function artcacheRelPath(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null;
  const rel = decodeURIComponent(url.slice(PREFIX.length));
  // Guard against path traversal.
  if (rel.includes('..')) return null;
  return rel;
}
