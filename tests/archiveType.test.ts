import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// DownloadManager pulls in electron transitively (appFetch); stub it for these pure helpers.
vi.mock('electron', () => ({ net: undefined, app: { getPath: () => tmpdir() } }));

const { extensionFromUrl, extensionFromContentType, sniffArchiveExtension } = await import(
  '../electron/services/DownloadManager.js'
);

/**
 * A real bug this guards against: romsfun's download page shows a name with NO extension
 * ("Akumajou Dracula X ... (2M)") while serving a 7z. The old code appended ".zip", and
 * 7-Zip — which selects its parser from the file extension — refused the perfectly valid
 * archive with "Cannot open the file as [zip] archive / Is not archive".
 */
describe('archive type detection', () => {
  describe('extensionFromUrl', () => {
    it('reads the extension from a token-bearing CDN url', () => {
      expect(
        extensionFromUrl('https://sto.romsfast.com/TRANS/Game%20(Japan).7z?token=abc%2Bdef'),
      ).toBe('.7z');
      expect(extensionFromUrl('https://statics.romsfun.com/GameBoy/Thing.zip?token=x')).toBe(
        '.zip',
      );
    });

    it('returns null when the path has no usable extension', () => {
      expect(extensionFromUrl('https://1fichier.com/?abc&af=1')).toBeNull();
      expect(extensionFromUrl('https://dl3.vimm.net/?mediaId=90722')).toBeNull();
      expect(extensionFromUrl('not a url')).toBeNull();
    });
  });

  describe('extensionFromContentType', () => {
    it('maps the archive content types romsfun actually returns', () => {
      expect(extensionFromContentType('application/x-7z-compressed')).toBe('.7z');
      expect(extensionFromContentType('application/zip')).toBe('.zip');
      expect(extensionFromContentType('application/zip; charset=binary')).toBe('.zip');
      expect(extensionFromContentType('text/html')).toBeNull();
      expect(extensionFromContentType(null)).toBeNull();
    });
  });

  describe('sniffArchiveExtension (magic bytes are the final authority)', () => {
    let dir: string;
    beforeAll(() => {
      dir = mkdtempSync(path.join(tmpdir(), 'sniff-'));
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    const write = (name: string, bytes: number[]) => {
      const p = path.join(dir, name);
      writeFileSync(p, Buffer.from([...bytes, ...new Array(64).fill(0)]));
      return p;
    };

    it('identifies a 7z archive even when it is named .zip', () => {
      // This is precisely the failing real-world case.
      expect(sniffArchiveExtension(write('mislabelled.zip', [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))).toBe(
        '.7z',
      );
    });

    it('identifies zip, rar and gzip', () => {
      expect(sniffArchiveExtension(write('a.bin', [0x50, 0x4b, 0x03, 0x04]))).toBe('.zip');
      expect(sniffArchiveExtension(write('b.bin', [0x52, 0x61, 0x72, 0x21]))).toBe('.rar');
      expect(sniffArchiveExtension(write('c.bin', [0x1f, 0x8b, 0x08, 0x00]))).toBe('.gz');
    });

    it('returns null for unknown content and missing files, never throwing', () => {
      expect(sniffArchiveExtension(write('d.bin', [0x00, 0x01, 0x02, 0x03]))).toBeNull();
      expect(sniffArchiveExtension(path.join(dir, 'does-not-exist'))).toBeNull();
    });
  });
});
