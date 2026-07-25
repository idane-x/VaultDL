import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import {
  parseRomList,
  parseDownloadPage,
  parseSizeText,
  fetchConsoleMap,
} from '../electron/services/sources/RomsfunClient.js';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

describe('parseRomList (Game Boy rom-list fixture)', () => {
  const json = JSON.parse(fixture('romsfun-rom-list-gb.json'));
  const page = parseRomList(json, { isSearch: false, page: 1, totalPages: 24 });

  it('extracts a full page of rows', () => {
    expect(page.items.length).toBeGreaterThanOrEqual(10);
  });

  it('stamps every row with source romsfun and systemCode GB', () => {
    expect(page.items.every((i) => i.source === 'romsfun')).toBe(true);
    expect(page.items.every((i) => i.systemCode === 'GB')).toBe(true);
  });

  it('carries a populated sourceRef with the rom slug', () => {
    for (const item of page.items) {
      expect(item.sourceRef.source).toBe('romsfun');
      expect(item.sourceRef.slug).toBeTruthy();
      expect(item.sourceRef.id).toBeTruthy();
    }
  });

  it('HTML-decodes titles (numeric, hex and named entities)', () => {
    const amp = page.items.find((i) => i.sourceRef.slug === 'a-cat-his-boy');
    const apos = page.items.find((i) => i.sourceRef.slug === 'all-star-baseball-99');
    const hexApos = page.items.find((i) => i.sourceRef.slug === 'all-star-baseball-99-3');
    expect(amp).toBeDefined();
    expect(amp!.title).toBe('A Cat & His Boy');
    expect(apos).toBeDefined();
    expect(apos!.title).toContain('’'); // '&#8217;' -> RIGHT SINGLE QUOTATION MARK
    expect(hexApos).toBeDefined();
    expect(hexApos!.title).toContain("'"); // '&#x27;' -> apostrophe
  });

  it('reports hasMore based on page vs totalPages', () => {
    expect(page.hasMore).toBe(true);
    const lastPage = parseRomList(json, { isSearch: false, page: 24, totalPages: 24 });
    expect(lastPage.hasMore).toBe(false);
  });

  it('vaultId is always 0 for romsfun rows', () => {
    expect(page.items.every((i) => i.vaultId === 0)).toBe(true);
  });
});

describe('fetchConsoleMap (console taxonomy fixture)', () => {
  it('builds a slug -> termId map covering known consoles', async () => {
    const json = JSON.parse(fixture('romsfun-consoles.json'));
    const map = await fetchConsoleMap({
      userAgent: 'TestAgent/1.0',
      fetchImpl: (async () =>
        new Response(JSON.stringify(json), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch,
    });

    expect(map.get('game-boy')).toBe(95);
    expect(map.get('gamecube')).toBe(13);
    expect(map.get('ms-dos')).toBe(19282);
  });
});

describe('parseDownloadPage (statics.romsfun.com fixture)', () => {
  const parsed = parseDownloadPage(fixture('romsfun-download-page.html'));

  it('extracts the CDN download url regardless of host', () => {
    expect(parsed.url).toContain('statics.romsfun.com');
  });

  it('extracts the real filename from the "You are downloading" heading', () => {
    expect(parsed.filename).toBeTruthy();
    expect(parsed.filename).toContain('4 in 1');
  });

  it('extracts the human size text', () => {
    expect(parsed.sizeText).toBe('137.52KB');
  });

  it('parseSizeText converts it to bytes within 1%', () => {
    const bytes = parseSizeText(parsed.sizeText as string);
    expect(bytes).not.toBeNull();
    expect(Math.abs((bytes as number) - 140800)).toBeLessThanOrEqual(140800 * 0.01);
  });
});

describe('parseDownloadPage (sto.romsfast.com alt-host fixture — proves host-agnostic extraction)', () => {
  const parsed = parseDownloadPage(fixture('romsfun-download-page-alt-host.html'));

  it('extracts the CDN download url from a completely different host', () => {
    expect(parsed.url).toContain('sto.romsfast.com');
  });

  it('extracts the human size text', () => {
    expect(parsed.sizeText).toBe('1.19 G');
  });

  it('parseSizeText handles the "G" (GiB) unit', () => {
    const bytes = parseSizeText(parsed.sizeText as string);
    expect(bytes).not.toBeNull();
    const expected = 1.19 * 1024 ** 3;
    expect(Math.abs((bytes as number) - expected)).toBeLessThanOrEqual(expected * 0.01);
  });
});

describe('parseDownloadPage error handling', () => {
  it('throws a clear error when a#download-link is missing', () => {
    expect(() => parseDownloadPage('<html><body>no link here</body></html>')).toThrow(
      /download-link/i,
    );
  });
});

describe('parseSizeText', () => {
  it('parses KB/MB/GB and bare K/M/G units', () => {
    expect(parseSizeText('700 MB')).toBe(Math.round(700 * 1024 ** 2));
    expect(parseSizeText('489.47 K')).toBe(Math.round(489.47 * 1024));
  });

  it('returns null for unparseable input', () => {
    expect(parseSizeText('n/a')).toBeNull();
    expect(parseSizeText('')).toBeNull();
  });
});
