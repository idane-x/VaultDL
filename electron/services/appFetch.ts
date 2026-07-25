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

export const appFetch: typeof fetch = ((input: FetchInput, init?: FetchInit) => {
  if (net && typeof net.fetch === 'function') {
    return net.fetch(input as never, init as never);
  }
  return fetch(input, init);
}) as typeof fetch;
