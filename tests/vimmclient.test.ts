import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import {
  parseList,
  parseDetail,
  buildDownloadRequest,
} from '../electron/services/VimmClient.js';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

describe('parseList (browse NES/USA advanced-list fixture)', () => {
  const page = parseList(fixture('adv-browse-nes-usa.html'), {
    isSearch: false,
    systemCode: 'NES',
    page: 1,
  });

  it('extracts many game rows', () => {
    expect(page.items.length).toBeGreaterThan(10);
  });

  it('parses vaultId, title and region for a known row', () => {
    const adv = page.items.find((i) => i.title.startsWith('Adventure Island II'));
    expect(adv).toBeDefined();
    expect(adv!.vaultId).toBe(30);
    expect(adv!.regions).toContain('USA');
  });

  it('stamps every row with the browsed systemCode', () => {
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((i) => i.systemCode === 'NES')).toBe(true);
  });

  it('never returns the 999999 sort-helper id', () => {
    expect(page.items.some((i) => i.vaultId === 999999)).toBe(false);
  });

  it('flags a row carrying the Unlicensed badge', () => {
    const unlicensed = page.items.find((i) => i.title.startsWith('Action 52'));
    expect(unlicensed).toBeDefined();
    expect(unlicensed!.unlicensed).toBe(true);
    // Other red-border badges (Prototype/Demo) must NOT be mistaken for Unlicensed.
    const prototype = page.items.find((i) => i.title === 'Addams Family, The' && i.version !== '1.0');
    if (prototype) expect(prototype.unlicensed).toBe(false);
  });

  it('is not marked isSearch', () => {
    expect(page.isSearch).toBe(false);
  });
});

describe('parseList (PS2 page 1 advanced-list fixture)', () => {
  it('reports hasMore true when a page=2 link exists', () => {
    const page = parseList(fixture('adv-browse-ps2-page1.html'), {
      isSearch: false,
      systemCode: 'PS2',
      page: 1,
    });
    expect(page.hasMore).toBe(true);
    expect(page.page).toBe(1);
  });

  it('reports hasMore false once past the last available page link', () => {
    const page = parseList(fixture('adv-browse-ps2-page1.html'), {
      isSearch: false,
      systemCode: 'PS2',
      page: 5,
    });
    expect(page.hasMore).toBe(false);
  });
});

describe('parseList (global search "zelda" advanced-list fixture)', () => {
  const page = parseList(fixture('adv-search-zelda.html'), {
    isSearch: true,
    page: 1,
  });

  it('extracts many game rows across systems', () => {
    expect(page.items.length).toBeGreaterThan(5);
  });

  it('is marked isSearch and reads systemCode from the System column per row', () => {
    expect(page.isSearch).toBe(true);
    const gc = page.items.find((i) => i.systemCode === 'GameCube');
    const nes = page.items.find((i) => i.systemCode === 'NES');
    expect(gc).toBeDefined();
    expect(nes).toBeDefined();
    expect(gc!.title).toContain('Zelda');
    expect(nes!.title).toContain('Zelda');
  });

  it('has no further page (no pagination block in the fixture)', () => {
    expect(page.hasMore).toBe(false);
  });
});

describe('parseDetail (NES detail fixture)', () => {
  const detail = parseDetail(fixture('nes-detail.html'), 94227, 'NES');

  it('reads the real download form action host', () => {
    expect(detail.downloadAction).toMatch(/^https:\/\/dl\d*\.vimm\.net\//);
  });

  it('extracts the media entry with mediaId distinct from the vault id', () => {
    expect(detail.media.length).toBeGreaterThan(0);
    expect(detail.media[0].mediaId).toBe(90722);
    expect(detail.media[0].mediaId).not.toBe(detail.vaultId);
  });

  it('decodes the base64 filename', () => {
    expect(detail.media[0].filename).toBe('Adventure Island II (Asia) (En) (Pirate).nes');
  });

  it('captures size in bytes from the KB-denominated Zipped field', () => {
    expect(detail.media[0].sizeBytes).toBe(121 * 1024);
  });
});

describe('buildDownloadRequest', () => {
  const detail = parseDetail(fixture('nes-detail.html'), 94227, 'NES');
  const { url, init } = buildDownloadRequest(detail, 0, 'TestAgent/1.0');

  it('GETs mediaId from the parsed action host with the required headers', () => {
    expect(init.method).toBe('GET');
    expect(url).toMatch(/^https:\/\/dl\d*\.vimm\.net\/\?/);
    expect(url).toContain('mediaId=90722');
    const headers = init.headers as Record<string, string>;
    expect(headers.Referer).toBe('https://vimm.net/vault/94227');
    expect(headers['User-Agent']).toBe('TestAgent/1.0');
  });

  it('omits alt for the default (index 0) format', () => {
    expect(url).not.toContain('alt=');
  });
});
