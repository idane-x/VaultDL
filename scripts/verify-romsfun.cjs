/**
 * Live end-to-end verification of the romsfun source, run inside ELECTRON.
 *
 * This can't be a vitest test: romsfun sits behind Cloudflare TLS fingerprinting, which
 * rejects Node/undici with a hard 403 regardless of headers. The app itself uses Electron's
 * Chromium-backed net.fetch (see electron/services/appFetch.ts), so the only faithful live
 * check is one that runs in the same stack.
 *
 * Run:  npx electron scripts/verify-romsfun.cjs
 * Exits non-zero on failure so it can gate a release.
 */
const { app, net } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const BASE = 'https://romsfun.com';
const API = BASE + '/wp-json/wp/v2';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

app.whenReady().then(async () => {
  try {
    // 1. Console taxonomy
    const consoles = await (
      await net.fetch(`${API}/console?per_page=100&_fields=id,slug,count`, {
        headers: { 'User-Agent': UA },
      })
    ).json();
    const gb = consoles.find((c) => c.slug === 'game-boy');
    check('console taxonomy', Array.isArray(consoles) && !!gb, `${consoles.length} consoles`);

    // 2. Browse a console (title-ascending, paginated)
    const listRes = await net.fetch(
      `${API}/rom?console=${gb.id}&orderby=title&order=asc&per_page=50&page=1&_fields=id,slug,link,title`,
      { headers: { 'User-Agent': UA } },
    );
    const roms = await listRes.json();
    const totalPages = Number(listRes.headers.get('X-WP-TotalPages') || '1');
    check('browse Game Boy', roms.length > 5 && totalPages > 1, `${roms.length} rows, ${totalPages} pages`);

    // 3. Cross-console search
    const searchRes = await net.fetch(`${API}/rom?search=zelda&per_page=5&_fields=id,title,link`, {
      headers: { 'User-Agent': UA },
    });
    check('global search', searchRes.ok, `X-WP-Total=${searchRes.headers.get('X-WP-Total')}`);

    // 4. Resolve a token-bearing CDN URL from the download page
    const target = roms[0];
    const dlPageUrl = `${BASE}/download/${target.slug}-${target.id}/1`;
    const html = await (
      await net.fetch(dlPageUrl, {
        headers: { 'User-Agent': UA, Referer: target.link },
      })
    ).text();
    const m =
      html.match(/<a\s[^>]*href="([^"]+)"[^>]*id="download-link"/) ||
      html.match(/id="download-link"[^>]*href="([^"]+)"/);
    check('resolve download link', !!m, m ? new URL(m[1]).host : 'no #download-link found');
    if (!m) throw new Error('cannot continue without a download link');
    const fileUrl = m[1];

    // 5. Range request => resume support
    const probe = await net.fetch(fileUrl, {
      headers: { 'User-Agent': UA, Referer: dlPageUrl, Range: 'bytes=0-1023' },
    });
    check('range request (resume)', probe.status === 206, `HTTP ${probe.status}`);
    await probe.arrayBuffer();

    // 6. Full download
    const fileRes = await net.fetch(fileUrl, {
      headers: { 'User-Agent': UA, Referer: dlPageUrl },
    });
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'romsfun-verify-'));
    const archive = path.join(dir, 'download.zip');
    fs.writeFileSync(archive, buf);
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
    check('download file', fileRes.ok && buf.length > 1000 && isZip, `${buf.length} bytes, zip=${isZip}`);
    console.log(`      saved: ${archive}`);
  } catch (e) {
    check('unexpected error', false, e.message);
  }

  console.log(failures === 0 ? '\nromsfun live verification: ALL PASSED' : `\n${failures} CHECK(S) FAILED`);
  app.exit(failures === 0 ? 0 : 1);
});
