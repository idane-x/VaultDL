import type { GameListItem, Region } from '@shared/types';

export interface ListingFilters {
  regions: Region[];
  /** Free-text version filter (substring match), or null for no filter. */
  version: string | null;
  /** Only show items whose rating text is present (non-null / non-empty). */
  ratedOnly: boolean;
}

export const EMPTY_FILTERS: ListingFilters = {
  regions: [],
  version: null,
  ratedOnly: false,
};

/** Case-insensitive substring search on title. Empty/blank query returns all items. */
export function applySearch(items: GameListItem[], query: string): GameListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.title.toLowerCase().includes(q));
}

/** Apply region/version/rating filters. Empty region list means "all regions". */
export function applyFilters(items: GameListItem[], filters: ListingFilters): GameListItem[] {
  return items.filter((item) => {
    if (filters.regions.length > 0) {
      const hasRegion = item.regions.some((r) => filters.regions.includes(r));
      if (!hasRegion) return false;
    }
    if (filters.version) {
      const v = item.version?.toLowerCase() ?? '';
      if (!v.includes(filters.version.toLowerCase())) return false;
    }
    if (filters.ratedOnly) {
      if (!item.rating || item.rating.toLowerCase() === 'none') return false;
    }
    return true;
  });
}

/** Derive the union of regions actually present across a listing, in Region enum order. */
export function collectRegions(items: GameListItem[]): Region[] {
  const present = new Set<Region>();
  for (const item of items) {
    for (const r of item.regions) present.add(r);
  }
  const order: Region[] = [
    'USA',
    'Europe',
    'Japan',
    'Asia',
    'Australia',
    'Korea',
    'China',
    'Brazil',
    'World',
    'Other',
  ];
  return order.filter((r) => present.has(r));
}
