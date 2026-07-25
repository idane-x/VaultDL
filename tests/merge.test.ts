import { describe, expect, it } from 'vitest';
import { mergeSourceItems, rowSourceKey } from '../electron/services/merge.js';
import type { GameListItem, SourceId } from '../electron/shared/types.js';

function makeItem(
  source: SourceId,
  id: string,
  title: string,
  systemCode: string | null,
  overrides: Partial<GameListItem> = {},
): GameListItem {
  return {
    vaultId: source === 'vimm' ? Number(id) || 0 : 0,
    source,
    sourceRef: { source, id },
    title,
    systemCode,
    regions: ['USA'],
    version: null,
    languages: [],
    rating: null,
    sizeText: null,
    serial: null,
    unlicensed: false,
    releaseDate: null,
    ...overrides,
  };
}

describe('mergeSourceItems', () => {
  it('(a) merges the same game from both sources despite tag differences, keeping both source rows', () => {
    // NB: match.ts is reused as-is (read-only contract). Its scorer weights token overlap
    // and character-level distance equally, so a plain tag/region difference clears the
    // 0.85 default threshold comfortably (score 1 here, since normalization strips the
    // tags entirely) — this is the realistic case: Vimm rows carry region/language tags,
    // romsfun's frequently don't.
    const vimm = makeItem('vimm', '101', 'Final Fantasy VII (Europe) (En,Fr,De)', 'PS1', {
      version: '1.1',
      rating: '9',
    });
    const romsfun = makeItem('romsfun', 'r-1', 'Final Fantasy VII', 'PS1');

    const rows = mergeSourceItems({ vimm: [vimm], romsfun: [romsfun] });

    expect(rows).toHaveLength(1);
    expect(rows[0].sources.vimm).toBe(vimm);
    expect(rows[0].sources.romsfun).toBe(romsfun);
    // Display fields prefer the Vimm row's richer metadata.
    expect(rows[0].version).toBe('1.1');
    expect(rows[0].rating).toBe('9');
  });

  it('(a2) reordered leading articles DO merge — Vimm uses the No-Intro "Title, The" form', () => {
    // Vimm writes "Legend of Zelda, The (USA)" (No-Intro convention) while romsfun writes
    // it naturally. normalizeTitle now folds the trailing article back, so both normalize
    // identically and the pair scores 1.0. Before that fix this scored 0.823 — under the
    // 0.85 threshold — which would have split most article-titled games into duplicate rows.
    const vimm = makeItem('vimm', '55', 'Legend of Zelda, The (USA)', 'NES');
    const romsfun = makeItem('romsfun', 'r-55', 'The Legend of Zelda', 'NES');

    const rows = mergeSourceItems({ vimm: [vimm], romsfun: [romsfun] });

    expect(rows).toHaveLength(1);
    expect(rows[0].sources.vimm).toBe(vimm);
    expect(rows[0].sources.romsfun).toBe(romsfun);
  });

  it('(a3) near-misses still stay unmerged — bias toward NOT merging', () => {
    // Numbered sequels are the classic trap: "Final Fantasy VII" vs "VIII" scores ~0.81,
    // safely under the threshold. A duplicate row beats downloading the wrong game.
    const vimm = makeItem('vimm', '56', 'Final Fantasy VII', 'PS1');
    const romsfun = makeItem('romsfun', 'r-56', 'Final Fantasy VIII', 'PS1');

    const rows = mergeSourceItems({ vimm: [vimm], romsfun: [romsfun] });

    expect(rows).toHaveLength(2);
  });

  it('(b) genuinely different games stay separate even under the same system', () => {
    const vimm = makeItem('vimm', '1', 'Chrono Trigger', 'SNES');
    const romsfun = makeItem('romsfun', 'r-1', 'Chrono Cross', 'SNES');

    const rows = mergeSourceItems({ vimm: [vimm], romsfun: [romsfun] });

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.sources.vimm === vimm)).toBeTruthy();
    expect(rows.find((r) => r.sources.romsfun === romsfun)).toBeTruthy();
  });

  it('(c) a romsfun-only item yields a row whose sources.vimm is undefined', () => {
    const romsfun = makeItem('romsfun', 'r-9', 'Some PS4 Exclusive', 'RF-PS4');

    const rows = mergeSourceItems({ vimm: [], romsfun: [romsfun] });

    expect(rows).toHaveLength(1);
    expect(rows[0].sources.vimm).toBeUndefined();
    expect(rows[0].sources.romsfun).toBe(romsfun);
  });

  it('(d) items with null systemCode never merge, even with an identical title', () => {
    const vimm = makeItem('vimm', '1', 'Mystery Game', null);
    const romsfun = makeItem('romsfun', 'r-1', 'Mystery Game', null);

    const rows = mergeSourceItems({ vimm: [vimm], romsfun: [romsfun] });

    expect(rows).toHaveLength(2);
    expect(rows[0].sources.vimm !== undefined && rows[0].sources.romsfun !== undefined).toBe(false);
    expect(rows[1].sources.vimm !== undefined && rows[1].sources.romsfun !== undefined).toBe(false);
  });

  it('(e) output stays title-sorted regardless of input order', () => {
    const vimm = [
      makeItem('vimm', '3', 'Zelda II: The Adventure of Link', 'NES'),
      makeItem('vimm', '1', 'Adventure Island', 'NES'),
    ];
    const romsfun = [
      makeItem('romsfun', 'r-2', 'Metroid', 'NES'),
      makeItem('romsfun', 'r-4', 'Contra', 'NES'),
    ];

    const rows = mergeSourceItems({ vimm, romsfun });
    const titles = rows.map((r) => r.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

    expect(titles).toEqual(sorted);
  });

  it('(f) two items from the same source never merge into each other', () => {
    // Two distinct listings that happen to normalize identically (e.g. a stray duplicate
    // row on the same source's page) must stay as two rows, each keyed distinctly.
    const vimmA = makeItem('vimm', '10', 'Duplicate Title', 'GBA');
    const vimmB = makeItem('vimm', '11', 'Duplicate Title', 'GBA');

    const rows = mergeSourceItems({ vimm: [vimmA, vimmB] });

    expect(rows).toHaveLength(2);
    expect(rows[0].key).not.toBe(rows[1].key);
    expect(rows.map((r) => r.sources.vimm)).toEqual(
      expect.arrayContaining([vimmA, vimmB]),
    );
  });

  it('populates sources.vimm as undefined (not a missing key edge case) when only romsfun supplies the row', () => {
    const romsfun = makeItem('romsfun', 'r-1', 'Only On Romsfun', 'RF-MAME');
    const rows = mergeSourceItems({ romsfun: [romsfun] });
    expect('vimm' in rows[0].sources).toBe(false);
  });
});

describe('rowSourceKey', () => {
  it('derives a stable per-source key from the row', () => {
    const vimm = makeItem('vimm', '42', 'Some Game', 'SNES');
    const rows = mergeSourceItems({ vimm: [vimm] });
    expect(rowSourceKey(rows[0], 'vimm')).toBe('vimm:42');
  });

  it('is undefined-safe for a source the row does not have', () => {
    const vimm = makeItem('vimm', '42', 'Some Game', 'SNES');
    const rows = mergeSourceItems({ vimm: [vimm] });
    expect(rowSourceKey(rows[0], 'romsfun')).toBe('romsfun:undefined');
  });
});
