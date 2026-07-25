/**
 * The fetch implementation the main process should use for ALL outbound site traffic.
 *
 * Why this exists: romsfun.com sits behind Cloudflare, which fingerprints the TLS
 * handshake — not just headers. Node's built-in fetch (undici) is rejected with a hard
 * HTTP 403 no matter what User-Agent/Accept headers you send, while Electron's `net.fetch`
 * goes through Chromium's network stack and is accepted (verified side by side in one
 * process: net.fetch 200 vs node fetch 403 on the same URLs).
 *
 * Using it everywhere also gets us Chromium's proxy resolution and cookie handling for
 * free, which matches how both sites expect a browser to behave.
 *
 * Falls back to global fetch outside Electron (unit tests run under plain Node/vitest).
 */
import { net } from 'electron';

// Derive the parameter types from `fetch` itself — the main-process tsconfig has no DOM
// lib, so DOM-only names like RequestInfo aren't in scope here.
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/** Read a header value out of any of the shapes RequestInit.headers can take. */
function headerValue(init: FetchInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (typeof Headers !== 'undefined' && h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) {
    const hit = h.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return hit ? hit[1] : null;
  }
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : null;
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * Route each request to the stack that can actually complete it.
 *
 * `Referer` is a forbidden header in the Fetch spec. Chromium enforces that: setting it on
 * a CROSS-ORIGIN request makes net.fetch fail with ERR_BLOCKED_BY_CLIENT, and its own
 * `referrer`/`referrerPolicy` options don't produce a referer those endpoints accept
 * (verified: Vimm's download host answers 400 for every net.fetch variant). Node's stack
 * sets the header verbatim, and Vimm has no TLS gate — so cross-origin-referer requests go
 * to Node.
 *
 * Everything else prefers net.fetch, because romsfun's Cloudflare rejects Node/undici on
 * TLS fingerprint with a hard 403. Its CDN needs no referer at all, so this works out.
 *
 * A same-origin Referer (romsfun's own /download/ pages) is fine on net.fetch and stays there.
 */
/**
 * True when a request must bypass Chromium and go out on Node's stack: it carries a
 * cross-origin `Referer` header, which Chromium refuses to send. Exported so the routing
 * rule itself is unit-testable without any network.
 */
export function requiresNodeStack(url: string, init?: FetchInit): boolean {
  const referer = headerValue(init, 'referer');
  return !!referer && !sameOrigin(referer, url);
}

export const appFetch: typeof fetch = (async (input: FetchInput, init?: FetchInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (requiresNodeStack(url, init)) return fetch(input, init);

  if (net && typeof net.fetch === 'function') {
    try {
      return await net.fetch(input as never, init as never);
    } catch (err) {
      // Chromium also refuses some third-party file hosts outright (1fichier). Node has no
      // such objection, so fall back rather than surfacing a cryptic Chromium error.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('ERR_BLOCKED_BY_CLIENT')) throw err;
      return await fetch(input, init);
    }
  }
  return fetch(input, init);
}) as typeof fetch;
