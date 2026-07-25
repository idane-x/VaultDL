import type { MergedRow, Region } from '@shared/types';

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

/** Apply region/version/rating filters. Empty region list means "all regions". */
export function applyFilters(rows: MergedRow[], filters: ListingFilters): MergedRow[] {
  return rows.filter((row) => {
    if (filters.regions.length > 0) {
      const hasRegion = row.regions.some((r) => filters.regions.includes(r));
      if (!hasRegion) return false;
    }
    if (filters.version) {
      const v = row.version?.toLowerCase() ?? '';
      if (!v.includes(filters.version.toLowerCase())) return false;
    }
    if (filters.ratedOnly) {
      if (!row.rating || row.rating.toLowerCase() === 'none') return false;
    }
    return true;
  });
}

/** Derive the union of regions actually present across a listing, in Region enum order. */
export function collectRegions(rows: MergedRow[]): Region[] {
  const present = new Set<Region>();
  for (const row of rows) {
    for (const r of row.regions) present.add(r);
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
