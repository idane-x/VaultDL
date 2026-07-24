/**
 * Extractor — extracts a .zip or .7z archive into a target folder using node-7z, driven
 * by the bundled 7za binary from 7zip-bin (so we don't depend on a system 7-Zip install).
 *
 * node-7z and 7zip-bin are CommonJS. From an ESM module their named exports aren't
 * statically detectable, so a plain `import { extractFull }` fails at runtime even though
 * it typechecks. We load them through createRequire (real CJS require) and keep the types
 * via a cast.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { extractFull } = require('node-7z') as typeof import('node-7z');
const sevenBin = require('7zip-bin') as typeof import('7zip-bin');

// In a packaged build the binary is unpacked (see electron-builder `asarUnpack`), so its
// real on-disk path lives under app.asar.unpacked, not inside the read-only asar.
const path7za = sevenBin.path7za.replace('app.asar', 'app.asar.unpacked');

export function extractArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = extractFull(archivePath, destDir, {
      $bin: path7za,
      $progress: true,
    });
    stream.on('end', () => resolve());
    stream.on('error', (err: Error) => reject(err));
  });
}
