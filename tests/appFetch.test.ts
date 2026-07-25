import { describe, it, expect, vi } from 'vitest';

// appFetch imports `electron`, which doesn't exist under vitest — stub it so the pure
// routing logic can be tested without a real Electron runtime.
vi.mock('electron', () => ({ net: undefined }));

const { requiresNodeStack } = await import('../electron/services/appFetch.js');

/**
 * The routing rule exists because the two HTTP stacks are blocked by different things:
 *  - Chromium (net.fetch) rejects a CROSS-ORIGIN `Referer` header outright with
 *    ERR_BLOCKED_BY_CLIENT, and its `referrer`/`referrerPolicy` options don't produce a
 *    referer Vimm's download host accepts (it answers 400 for every net.fetch variant).
 *  - Node/undici is rejected by romsfun's Cloudflare on TLS fingerprint (hard 403).
 * So: cross-origin Referer => Node; everything else => Chromium.
 */
describe('requiresNodeStack', () => {
  it('routes a cross-origin Referer to Node (Vimm download: vimm.net -> dl3.vimm.net)', () => {
    expect(
      requiresNodeStack('https://dl3.vimm.net/?mediaId=90722', {
        headers: { 'User-Agent': 'x', Referer: 'https://vimm.net/vault/94227' },
      }),
    ).toBe(true);
  });

  it('keeps a same-origin Referer on Chromium (romsfun download page)', () => {
    expect(
      requiresNodeStack('https://romsfun.com/download/some-slug-123/1', {
        headers: { Referer: 'https://romsfun.com/roms/game-boy/some-slug.html' },
      }),
    ).toBe(false);
  });

  it('keeps referer-less requests on Chromium (romsfun CDN + API — Cloudflare needs it)', () => {
    expect(requiresNodeStack('https://sto.romsfast.com/x.7z?token=abc', {
      headers: { 'User-Agent': 'x' },
    })).toBe(false);
    expect(requiresNodeStack('https://romsfun.com/wp-json/wp/v2/rom')).toBe(false);
  });

  it('reads the header case-insensitively and from every headers shape', () => {
    const url = 'https://dl3.vimm.net/';
    const ref = 'https://vimm.net/vault/1';
    expect(requiresNodeStack(url, { headers: { referer: ref } })).toBe(true);
    expect(requiresNodeStack(url, { headers: [['Referer', ref]] })).toBe(true);
    expect(requiresNodeStack(url, { headers: new Headers({ Referer: ref }) })).toBe(true);
  });

  it('does not treat a differing scheme/port as same-origin', () => {
    expect(
      requiresNodeStack('https://vimm.net/x', { headers: { Referer: 'http://vimm.net/y' } }),
    ).toBe(true);
  });

  it('treats an unparseable referer as cross-origin rather than silently trusting it', () => {
    expect(requiresNodeStack('https://vimm.net/x', { headers: { Referer: 'not a url' } })).toBe(
      true,
    );
  });
});
