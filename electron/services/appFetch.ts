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

export const appFetch: typeof fetch = (async (input: FetchInput, init?: FetchInit) => {
  if (net && typeof net.fetch === 'function') {
    try {
      return await net.fetch(input as never, init as never);
    } catch (err) {
      // Chromium refuses some third-party file hosts outright with ERR_BLOCKED_BY_CLIENT
      // (1fichier, for instance). Node's stack has no such objection, so fall back rather
      // than surfacing a cryptic Chromium error. The reverse case — Cloudflare rejecting
      // Node on TLS fingerprint — is why net.fetch is still tried first.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('ERR_BLOCKED_BY_CLIENT')) throw err;
      return await fetch(input, init);
    }
  }
  return fetch(input, init);
}) as typeof fetch;
