/**
 * Pure title-matching helpers used to pick the right provider result out of a search
 * response. No network, no Electron imports — safe to unit test directly and to reuse
 * from both TgdbProvider and RawgProvider.
 */

const ARTICLE_RE = /^(the|a|an)\s+/;
/**
 * No-Intro/Vimm move the leading article to the end: "Legend of Zelda, The" and
 * "Legend of Zelda, The: Link's Awakening". Other catalogues (romsfun, TheGamesDB, RAWG)
 * write them naturally, so without this the same game normalizes to two different strings
 * and a real match can score below the merge threshold. Runs while the comma still exists.
 */
const TRAILING_ARTICLE_RE = /,\s*(the|a|an)\b(?=\s*(:|$))/g;
// Parenthetical/bracket tag groups: (USA), (Rev 1), (En,Fr,De), [!], [b], etc. A group
// never nests another bracket/paren, so a non-greedy "no bracket chars inside" class is
// enough; the leading \s* also swallows the space that preceded the tag.
const TAG_GROUP_RE = /\s*[[(][^[\]()]*[\])]/g;
const EXTENSION_RE = /\.[a-z0-9]{1,4}$/i;
const TRAILING_DISC_RE = /\s*-?\s*(disc|disk)\s*\d+\s*$/i;

/**
 * Normalize a ROM/provider title for comparison: strips region/version/language tags,
 * file extensions, and trailing disc markers; lowercases; folds "&" to "and"; strips
 * remaining punctuation; collapses whitespace; drops a leading article.
 */
export function normalizeTitle(raw: string): string {
  let s = raw;

  s = s.replace(EXTENSION_RE, '');
  // Two passes: removing one tag group can occasionally expose whitespace that a single
  // pass already handles, but this stays cheap insurance for titles with several groups.
  s = s.replace(TAG_GROUP_RE, '');
  s = s.replace(TAG_GROUP_RE, '');
  s = s.replace(TRAILING_DISC_RE, '');

  s = s.toLowerCase();
  s = s.replace(/&/g, ' and ');
  // Fold "Title, The" -> "Title" while the comma is still present to anchor on.
  s = s.replace(TRAILING_ARTICLE_RE, '');
  // Strip remaining punctuation (colons, apostrophes, exclamation marks, hyphens, ...).
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(ARTICLE_RE, '');

  return s.trim();
}

/** Classic Levenshtein edit distance, O(n*m) time / O(min(n,m)) extra space. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

function levenshteinRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(' ').filter(Boolean));
  const bTokens = new Set(b.split(' ').filter(Boolean));
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let shared = 0;
  for (const t of aTokens) if (bTokens.has(t)) shared += 1;
  // Sorensen-Dice coefficient.
  return (2 * shared) / (aTokens.size + bTokens.size);
}

/**
 * 0..1 similarity between a query and a candidate title, combining token overlap (order-
 * independent, forgiving of subtitle reordering) with a Levenshtein-ratio component
 * (catches close character-level matches token overlap alone would miss).
 */
export function scoreMatch(query: string, candidate: string): number {
  const nq = normalizeTitle(query);
  const nc = normalizeTitle(candidate);
  if (nq.length === 0 || nc.length === 0) return nq === nc ? 1 : 0;
  if (nq === nc) return 1;

  const overlap = tokenOverlap(nq, nc);
  const ratio = levenshteinRatio(nq, nc);
  const score = overlap * 0.5 + ratio * 0.5;
  return Math.max(0, Math.min(1, score));
}

/** Pick the best-scoring item for `query`, or null if nothing clears `threshold`. */
export function pickBest<T>(
  query: string,
  items: T[],
  getTitle: (item: T) => string,
  threshold = 0.45,
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const score = scoreMatch(query, getTitle(item));
    if (!best || score > best.score) best = { item, score };
  }
  if (!best || best.score < threshold) return null;
  return best;
}
