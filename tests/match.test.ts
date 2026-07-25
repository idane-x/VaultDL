import { describe, it, expect } from 'vitest';
import { normalizeTitle, scoreMatch, pickBest } from '../electron/services/metadata/match.js';

describe('normalizeTitle', () => {
  it('strips region/version tags so the tagged and bare titles match', () => {
    const a = normalizeTitle('Grand Theft Auto: San Andreas (USA) (Rev 1)');
    const b = normalizeTitle('Grand Theft Auto: San Andreas');
    expect(a).toBe(b);
    expect(a).toBe('grand theft auto san andreas');
  });

  it('strips bracketed dump-quality tags', () => {
    expect(normalizeTitle('Super Mario Bros. [!]')).toBe('super mario bros');
  });

  it('strips a multi-language tag group', () => {
    expect(normalizeTitle('Final Fantasy VII (Europe) (En,Fr,De)')).toBe('final fantasy vii');
  });

  it('strips a file extension', () => {
    expect(normalizeTitle('Chrono Trigger.sfc')).toBe('chrono trigger');
  });

  it('strips a pirate tag and a bad-dump bracket together', () => {
    expect(normalizeTitle('Contra Force (USA) (Pirate) [b]')).toBe('contra force');
  });

  it('strips a trailing disc marker', () => {
    expect(normalizeTitle('Final Fantasy VII (Disc 2)')).toBe('final fantasy vii');
  });

  it('drops a leading article', () => {
    expect(normalizeTitle('The Legend of Zelda')).toBe('legend of zelda');
  });

  it('normalizes an ampersand to "and"', () => {
    expect(normalizeTitle('Simon & Garfunkel Sim')).toBe('simon and garfunkel sim');
  });

  it('collapses internal punctuation and whitespace', () => {
    expect(normalizeTitle("Kirby's   Adventure")).toBe('kirby s adventure');
  });
});

describe('scoreMatch', () => {
  it('scores an exact match (post-normalization) at 1', () => {
    expect(scoreMatch('Chrono Trigger', 'Chrono Trigger (USA)')).toBe(1);
  });

  it('scores a close fuzzy match highly', () => {
    const score = scoreMatch('Pokemon Red Version', 'Pokemon Red');
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThan(1);
  });

  it('scores unrelated titles low', () => {
    const score = scoreMatch('Super Mario Bros. 3', 'Tetris');
    expect(score).toBeLessThan(0.3);
  });
});

describe('pickBest', () => {
  interface Item {
    title: string;
  }
  const items: Item[] = [
    { title: 'Metroid Prime' },
    { title: 'Metroid Prime 2: Echoes' },
    { title: 'Mario Kart: Double Dash!!' },
  ];

  it('picks the exact-matching candidate over near-matches', () => {
    const result = pickBest('Metroid Prime', items, (i) => i.title);
    expect(result).not.toBeNull();
    expect(result!.item.title).toBe('Metroid Prime');
    expect(result!.score).toBe(1);
  });

  it('picks the right candidate among differently-punctuated titles', () => {
    const result = pickBest('Mario Kart Double Dash', items, (i) => i.title);
    expect(result).not.toBeNull();
    expect(result!.item.title).toBe('Mario Kart: Double Dash!!');
  });

  it('returns null when nothing clears the threshold', () => {
    const result = pickBest('Half-Life 2', items, (i) => i.title, 0.5);
    expect(result).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    expect(pickBest('Anything', [], (i: Item) => i.title)).toBeNull();
  });
});

/**
 * Vimm follows the No-Intro convention of moving the leading article to the end
 * ("Legend of Zelda, The"), while romsfun / TheGamesDB / RAWG write titles naturally.
 * Without folding that back, real cross-source matches scored BELOW the 0.85 merge
 * threshold (0.823) — lower than a genuinely wrong pairing like Final Fantasy VII vs VIII
 * (0.806) — so the same game would show up as two rows. These lock in the fix.
 */
describe('trailing-article normalization (cross-source matching)', () => {
  const pairs: [string, string][] = [
    ['Legend of Zelda, The (USA)', 'The Legend of Zelda'],
    ["Legend of Zelda, The: Link's Awakening (USA)", "The Legend of Zelda: Link's Awakening"],
    ['Adventures of Batman & Robin, The (USA)', 'The Adventures of Batman & Robin'],
    ['Simpsons, The: Bart vs. the Space Mutants', 'The Simpsons: Bart vs. the Space Mutants'],
  ];

  it.each(pairs)('folds "%s" onto "%s"', (a, b) => {
    expect(normalizeTitle(a)).toBe(normalizeTitle(b));
    expect(scoreMatch(a, b)).toBe(1);
  });

  it('keeps genuinely different titles apart with a safe margin', () => {
    // Must stay well below the 0.85 merge threshold — a wrong merge downloads the wrong game.
    expect(scoreMatch('Final Fantasy VII', 'Final Fantasy VIII')).toBeLessThan(0.85);
  });

  it('does not strip a comma-article that is mid-title', () => {
    // Only a trailing ", The" (or before a subtitle colon) is an article marker.
    expect(normalizeTitle('Me, Myself and I')).toContain('myself');
  });
});
