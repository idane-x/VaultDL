/**
 * merge.ts — combines per-source listing pages into the unified MergedRow catalog the UI
 * renders. PURE: no network, no Electron imports, safe to unit test directly.
 *
 * Algorithm (normalized-title index, not a strict two-pointer merge-sort walk): a strict
 * pointer-walk assumes both sources sort identically, but they don't necessarily agree on
 * where an article ("The Legend of Zelda" vs "Legend of Zelda, The") sorts, so a walk can
 * desync. Instead we build rows incrementally — bucketed by systemCode so comparisons stay
 * cheap — and sort the finished set by title at the end. That guarantees title-sorted output
 * regardless of the two sources' internal ordering quirks.
 *
 * Merge bar is intentionally high (see mergeSourceItems' threshold): a duplicate row is a
 * far better failure than silently downloading the wrong game.
 */
import type { GameListItem, MergedRow, SourceId } from '@shared/types.js';
import { normalizeTitle, scoreMatch } from './metadata/match.js';

/** Fixed processing order: Vimm first, since it carries richer metadata (regions/version/
 * rating/serial) that we want new rows to be seeded with whenever it's available. */
const SOURCE_PRIORITY: SourceId[] = ['vimm', 'romsfun'];

const DEFAULT_THRESHOLD = 0.85;

function bucketKey(systemCode: string | null): string {
  return systemCode ?? 'unknown';
}

function baseRowKey(systemCode: string | null, title: string): string {
  return `${bucketKey(systemCode)}:${normalizeTitle(title)}`;
}

function seedRow(item: GameListItem, key: string): MergedRow {
  return {
    key,
    title: item.title,
    systemCode: item.systemCode,
    regions: item.regions,
    version: item.version,
    languages: item.languages,
    rating: item.rating,
    sizeText: item.sizeText,
    unlicensed: item.unlicensed,
    releaseDate: item.releaseDate,
    sources: { [item.source]: item } as Partial<Record<SourceId, GameListItem>>,
  };
}

/** Overwrite a row's display fields from `item` (used when a Vimm item — richer metadata —
 * merges into a row that was originally seeded by a non-Vimm item). */
function upgradeDisplayFields(row: MergedRow, item: GameListItem): void {
  row.title = item.title;
  row.systemCode = item.systemCode;
  row.regions = item.regions;
  row.version = item.version;
  row.languages = item.languages;
  row.rating = item.rating;
  row.sizeText = item.sizeText;
  row.unlicensed = item.unlicensed;
  row.releaseDate = item.releaseDate;
}

/**
 * Merge per-source listing pages into the unified catalog.
 *
 * Two items merge into a single MergedRow only when BOTH hold:
 *  - their `systemCode`s are equal and non-null (null == "unknown", and unknowns never
 *    merge with anything — including each other, since we can't be sure they're the same
 *    system)
 *  - `scoreMatch(normalizeTitle(a.title), normalizeTitle(b.title)) >= threshold`
 *
 * Two items from the SAME source are never merged into each other. Display fields prefer
 * the Vimm row's values when a Vimm row is present, falling back to the other source's.
 */
export function mergeSourceItems(
  lists: Partial<Record<SourceId, GameListItem[]>>,
  opts?: { threshold?: number },
): MergedRow[] {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;

  const rows: MergedRow[] = [];
  // systemCode bucket -> indices into `rows`. Keeps candidate comparison scoped to same-
  // system rows only, instead of scanning every row for every incoming item.
  const buckets = new Map<string, number[]>();
  // Tracks how many rows have already claimed a given base key, so collisions (two
  // distinct, non-merging rows that happen to normalize to the same title) get a
  // deterministic distinguishing suffix instead of colliding.
  const keyUses = new Map<string, number>();

  const nextKey = (systemCode: string | null, title: string): string => {
    const base = baseRowKey(systemCode, title);
    const uses = keyUses.get(base) ?? 0;
    keyUses.set(base, uses + 1);
    return uses === 0 ? base : `${base}#${uses + 1}`;
  };

  const sourceIds = SOURCE_PRIORITY.filter((s) => lists[s]);
  // Future-proofing: include any source present in `lists` that isn't in SOURCE_PRIORITY
  // (shouldn't happen given today's SourceId union, but keeps this from silently dropping
  // data if a third source is ever added here without updating the priority list).
  for (const s of Object.keys(lists) as SourceId[]) {
    if (!sourceIds.includes(s)) sourceIds.push(s);
  }

  for (const source of sourceIds) {
    const items = lists[source];
    if (!items) continue;

    for (const item of items) {
      let matchedRow: MergedRow | null = null;

      // Never merge on a null/unknown systemCode — skip candidate lookup entirely so such
      // items always become their own new row.
      if (item.systemCode !== null) {
        const candidateIdx = buckets.get(bucketKey(item.systemCode)) ?? [];
        let bestScore = 0;
        for (const idx of candidateIdx) {
          const row = rows[idx];
          if (row.sources[source]) continue; // never merge two items from the same source
          if (row.systemCode !== item.systemCode) continue; // defensive; bucket already scopes this

          const score = scoreMatch(normalizeTitle(row.title), normalizeTitle(item.title));
          if (score >= threshold && score > bestScore) {
            bestScore = score;
            matchedRow = row;
          }
        }
      }

      if (matchedRow) {
        const hadVimm = !!matchedRow.sources.vimm;
        matchedRow.sources[item.source] = item;
        if (item.source === 'vimm' && !hadVimm) {
          upgradeDisplayFields(matchedRow, item);
        }
      } else {
        const key = nextKey(item.systemCode, item.title);
        const row = seedRow(item, key);
        rows.push(row);
        const bkey = bucketKey(item.systemCode);
        const arr = buckets.get(bkey);
        if (arr) arr.push(rows.length - 1);
        else buckets.set(bkey, [rows.length - 1]);
      }
    }
  }

  rows.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
  return rows;
}

/** Stable per-source dedup key for a merged row, e.g. for the UI to check "is this source's
 * copy of this game already queued" without re-deriving the source's identity scheme. */
export function rowSourceKey(row: MergedRow, source: SourceId): string {
  return `${source}:${row.sources[source]?.sourceRef.id}`;
}
