import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import {
  parseListing,
  parseDetail,
  buildDownloadRequest,
} from '../electron/services/VimmClient.js';

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf-8');

describe('parseListing (NES /A fixture)', () => {
  const items = parseListing(fixture('nes-listing.html'));

  it('extracts multiple game rows', () => {
    expect(items.length).toBeGreaterThan(1);
  });

  it('parses vaultId, title, region and language for a known row', () => {
    const adv = items.find((i) => i.title.startsWith('Adventure Island II'));
    expect(adv).toBeDefined();
    expect(adv!.vaultId).toBe(94227);
    expect(adv!.regions).toContain('Asia');
    expect(adv!.languages).toContain('en');
  });

  it('never returns the 999999 sort-helper id', () => {
    expect(items.some((i) => i.vaultId === 999999)).toBe(false);
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
