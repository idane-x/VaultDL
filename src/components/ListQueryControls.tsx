import type { SortOrder } from '@shared/types';
import { SORT_OPTIONS, VAULT_REGIONS } from '@shared/vault-filters';

export interface ListQueryControlsProps {
  regionId: string;
  onRegionChange: (regionId: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  sortOrder: SortOrder;
  onToggleSortOrder: () => void;
}

/**
 * Server-side query controls for the advanced-list endpoint: region (required by the
 * site — no "all regions" option exists), sort field, and ASC/DESC order.
 */
export default function ListQueryControls({
  regionId,
  onRegionChange,
  sort,
  onSortChange,
  sortOrder,
  onToggleSortOrder,
}: ListQueryControlsProps) {
  const selectClasses =
    'rounded-md border border-vault-border bg-vault-panel2 px-2 py-1.5 text-sm text-vault-text focus:border-vault-accent focus:outline-none';

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={regionId}
        onChange={(e) => onRegionChange(e.target.value)}
        aria-label="Region"
        title="Region"
        className={selectClasses}
      >
        {VAULT_REGIONS.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="Sort by"
        title="Sort by"
        className={selectClasses}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onToggleSortOrder}
        aria-label={sortOrder === 'ASC' ? 'Sort ascending' : 'Sort descending'}
        title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
        className="rounded-md border border-vault-border bg-vault-panel2 px-2.5 py-1.5 text-sm text-vault-text transition-colors hover:border-vault-accent/50"
      >
        {sortOrder === 'ASC' ? '↑ ASC' : '↓ DESC'}
      </button>
    </div>
  );
}
