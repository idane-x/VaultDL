import { useState } from 'react';
import type { Region } from '@shared/types';
import type { ListingFilters } from '../lib/filtering';
import { regionFlagEmoji } from '../lib/format';

export interface FilterBarProps {
  availableRegions: Region[];
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
}

/** Region multi-select + version/rating filter controls. Emits a full ListingFilters object. */
export default function FilterBar({ availableRegions, filters, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  const toggleRegion = (region: Region) => {
    const has = filters.regions.includes(region);
    const regions = has
      ? filters.regions.filter((r) => r !== region)
      : [...filters.regions, region];
    onChange({ ...filters, regions });
  };

  const activeCount =
    filters.regions.length + (filters.version ? 1 : 0) + (filters.ratedOnly ? 1 : 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
          activeCount > 0
            ? 'border-vault-accent/50 bg-vault-accent/10 text-vault-text'
            : 'border-vault-border bg-vault-panel2 text-vault-muted hover:text-vault-text'
        }`}
      >
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="rounded-full bg-vault-accent px-1.5 text-xs text-vault-bg">
            {activeCount}
          </span>
        )}
        <span className="text-xs">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-20 mt-2 w-72 rounded-lg border border-vault-border bg-vault-panel p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-vault-muted">
                Region
              </span>
              {filters.regions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...filters, regions: [] })}
                  className="text-xs text-vault-accent hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {availableRegions.length === 0 && (
                <span className="text-xs text-vault-muted">No region data yet</span>
              )}
              {availableRegions.map((region) => {
                const active = filters.regions.includes(region);
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                      active
                        ? 'border-vault-accent bg-vault-accent/15 text-vault-text'
                        : 'border-vault-border text-vault-muted hover:text-vault-text'
                    }`}
                  >
                    <span>{regionFlagEmoji(region)}</span>
                    <span>{region}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-vault-muted">
                Version contains
              </label>
              <input
                type="text"
                value={filters.version ?? ''}
                onChange={(e) => onChange({ ...filters, version: e.target.value || null })}
                placeholder="e.g. Rev 1"
                className="w-full rounded-md border border-vault-border bg-vault-panel2 px-2 py-1 text-sm text-vault-text placeholder:text-vault-muted focus:border-vault-accent focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-vault-text">
              <input
                type="checkbox"
                checked={filters.ratedOnly}
                onChange={(e) => onChange({ ...filters, ratedOnly: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-vault-border bg-vault-panel2 accent-vault-accent"
              />
              Rated titles only
            </label>
          </div>
        </>
      )}
    </div>
  );
}
