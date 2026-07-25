/**
 * End-to-end download verification for BOTH sources, in the real Electron runtime,
 * exercising the same stack-routing rule as electron/services/appFetch.ts:
 *   cross-origin `Referer` header  -> Node fetch (Chromium refuses it)
 *   everything else                -> Chromium net.fetch (Cloudflare rejects Node)
 *
 * Run:  npm run verify:downloads
 * Exits non-zero on failure.
 */
const { app, net } = require('electron');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const sameOrigin = (a, b) => {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};

/** Mirrors appFetch's routing. */
async function appFetch(url, init = {}) {
  const referer = Object.entries(init.headers || {}).find(
    ([k]) => k.toLowerCase() === 'referer',
  )?.[1];
  if (referer && !sameOrigin(referer, url)) return fetch(url, init);
  try {
    return await net.fetch(url, init);
  } catch (e) {
    if (!String(e.message).includes('ERR_BLOCKED_BY_CLIENT')) throw e;
    return fetch(url, init);
  }
}

/** Pull only the first KB so we never drag down a multi-GB ISO. */
async function probe(label, url, init) {
  try {
    const res = await appFetch(url, {
      ...init,
      headers: { ...(init.headers || {}), Range: 'bytes=0-1023' },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const ok = (res.status === 206 || res.status === 200) && buf.length > 0;
    check(label, ok, `HTTP ${res.status}, ${buf.length}B, ${res.headers.get('content-type')}`);
    return ok;
  } catch (e) {
    check(label, false, e.message);
    return false;
  }
}

app.whenReady().then(async () => {
  // ---------- Vimm: needs a cross-origin Referer header -> Node stack ----------
  try {
    const vaultId = 94227;
    const html = await (
      await appFetch(`https://vimm.net/vault/${vaultId}`, { headers: { 'User-Agent': UA } })
    ).text();
    const action = (html.match(/action="(\/\/dl\d*\.vimm\.net\/?)"/) || [])[1];
    const mediaId = (html.match(/name="mediaId"\s+value="(\d+)"/) || [])[1];
    check('vimm: resolve download form', !!action && !!mediaId, `${action} mediaId=${mediaId}`);
    await probe('vimm: file transfer', `https:${action}?mediaId=${mediaId}`, {
      headers: { 'User-Agent': UA, Referer: `https://vimm.net/vault/${vaultId}` },
    });
  } catch (e) {
    check('vimm: unexpected error', false, e.message);
  }

  // ---------- romsfun: Cloudflare -> Chromium stack, CDN needs no referer ----------
  try {
    const rom = (
      await (
        await appFetch(
          'https://romsfun.com/wp-json/wp/v2/rom?search=akumajou%20dracula&per_page=1&_fields=id,slug,link',
          { headers: { 'User-Agent': UA } },
        )
      ).json()
    )[0];
    check('romsfun: api reachable', !!rom, rom && rom.slug);

    const pageUrl = `https://romsfun.com/download/${rom.slug}-${rom.id}/1`;
    const page = await appFetch(pageUrl, {
      headers: { 'User-Agent': UA, Referer: rom.link }, // same-origin -> stays on Chromium
    });
    const dl = await page.text();
    const m = dl.match(/<a\s[^>]*href="([^"]+)"[^>]*id="download-link"/);
    check('romsfun: resolve download link', !!m, m && new URL(m[1].replace(/&#0?38;/g, '&')).host);
    if (m) {
      const cdn = m[1].replace(/&#0?38;/g, '&');
      // No Referer header here — cross-origin, and the ?token= is the authorisation.
      await probe('romsfun: file transfer', cdn, { headers: { 'User-Agent': UA } });
    }
  } catch (e) {
    check('romsfun: unexpected error', false, e.message);
  }

  console.log(failures === 0 ? '\nDownload verification: ALL PASSED' : `\n${failures} CHECK(S) FAILED`);
  app.exit(failures === 0 ? 0 : 1);
});
