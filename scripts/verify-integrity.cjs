/**
 * Verify the archive-type fix against the real failing download.
 *
 * Reuses a cached copy when present so it doesn't re-pull 357 MiB every run.
 * Proves: bytes match Content-Length, the archive is really a 7z (not the .zip we used to
 * name it), and 7-Zip extracts it once the name matches the content.
 *
 * Run: npm run verify:integrity
 */
const { app, net } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractFull } = require('node-7z');
const sevenBin = require('7zip-bin');
const path7za = sevenBin.path7za.replace('app.asar', 'app.asar.unpacked');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const SLUG = 'akumajou-dracula-x-gekka-no-yasoukyoku';
const ID = '102868';
const CACHE = path.join(os.tmpdir(), 'vaultdl-diag-saturn.bin');

let failures = 0;
const check = (l, ok, d = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${d ? '  — ' + d : ''}`);
  if (!ok) failures++;
};

/** Same magic-byte sniff as DownloadManager.sniffArchiveExtension. */
function sniff(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(8);
  fs.readSync(fd, b, 0, 8, 0);
  fs.closeSync(fd);
  if (b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) return '.7z';
  if (b[0] === 0x50 && b[1] === 0x4b) return '.zip';
  return null;
}

const extract = (archive, dest) =>
  new Promise((res, rej) => {
    const s = extractFull(archive, dest, { $bin: path7za, $progress: false });
    s.on('end', res);
    s.on('error', rej);
  });

app.whenReady().then(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-'));
  try {
    let expected = null;
    if (!fs.existsSync(CACHE)) {
      const html = await (
        await net.fetch(`https://romsfun.com/download/${SLUG}-${ID}/1`, {
          headers: { 'User-Agent': UA },
          referrer: `https://romsfun.com/roms/sega-saturn/${SLUG}.html`,
        })
      ).text();
      const cdn = html
        .match(/<a\s[^>]*href="([^"]+)"[^>]*id="download-link"/)[1]
        .replace(/&#0?38;/g, '&');
      console.log(`      url extension: ${path.extname(new URL(cdn).pathname)}`);
      const res = await net.fetch(cdn, { headers: { 'User-Agent': UA } });
      expected = Number(res.headers.get('content-length'));
      console.log(`      content-type : ${res.headers.get('content-type')}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(CACHE, buf);
      check('bytes match Content-Length', buf.length === expected, `${buf.length}`);
    } else {
      console.log(`      (reusing cached ${fs.statSync(CACHE).size} bytes)`);
    }

    // The core regression: content says 7z, so naming it .zip breaks 7-Zip.
    const ext = sniff(CACHE);
    check('magic bytes identify the real format', ext === '.7z', `${ext}`);

    const wrong = path.join(dir, 'game.zip');
    fs.copyFileSync(CACHE, wrong);
    let wrongFailed = false;
    try {
      await extract(wrong, path.join(dir, 'out-wrong'));
    } catch {
      wrongFailed = true;
    }
    check('mislabelled .zip fails to extract (the reported bug)', wrongFailed);

    const right = path.join(dir, `game${ext}`);
    fs.renameSync(wrong, right);
    const out = path.join(dir, 'out-right');
    await extract(right, out);
    const files = fs.readdirSync(out);
    check('correctly-named archive extracts', files.length === 3, files.join(', '));
    const track1 = files.find((f) => /Track 1\)\.bin$/i.test(f));
    if (track1) {
      const size = fs.statSync(path.join(out, track1)).size;
      check('Track 1 matches the archive listing', size === 481720176, String(size));
    }
  } catch (e) {
    check('unexpected error', false, e.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures === 0 ? '\nIntegrity verification: ALL PASSED' : `\n${failures} FAILED`);
  app.exit(failures === 0 ? 0 : 1);
});
