import type { GameListItem, MetaLookup } from '@shared/types';
import { SYSTEM_BY_CODE } from '@shared/systems';
import GameCover from './GameCover';
import { regionFlagEmoji } from '../lib/format';

export interface GameTableProps {
  items: GameListItem[];
  isLoading: boolean;
  /** Show a System column — enabled in global search mode where rows span consoles. */
  showSystem: boolean;
  metadataEnabled: boolean;
  onAdd: (item: GameListItem) => void;
  onOpenOverride: (lookup: MetaLookup) => void;
  /** vaultIds currently present in the download queue, to disable/relabel the button. */
  queuedVaultIds?: Set<number>;
}

function RegionCell({ regions }: { regions: GameListItem['regions'] }) {
  if (regions.length === 0) return <span className="text-vault-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1" title={regions.join(', ')}>
      {regions.map((r) => (
        <span key={r}>{regionFlagEmoji(r)}</span>
      ))}
    </span>
  );
}

function systemLabel(systemCode: string | null): string {
  if (!systemCode) return 'Unknown';
  return SYSTEM_BY_CODE[systemCode]?.label ?? systemCode;
}

/** Renders a listing as a table with a per-row download action. Handles loading/empty states. */
export default function GameTable({
  items,
  isLoading,
  showSystem,
  metadataEnabled,
  onAdd,
  onOpenOverride,
  queuedVaultIds,
}: GameTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-vault-muted">
        Loading listing…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-vault-muted">
        <span className="text-3xl">📭</span>
        <span className="text-sm">No games match this view</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-vault-panel">
          <tr className="border-b border-vault-border text-start text-xs uppercase tracking-wide text-vault-muted">
            <th className="px-3 py-2" />
            <th className="px-3 py-2 text-start font-medium">Title</th>
            {showSystem && <th className="px-3 py-2 text-start font-medium">System</th>}
            <th className="px-3 py-2 text-start font-medium">Region</th>
            <th className="px-3 py-2 text-start font-medium">Version</th>
            <th className="px-3 py-2 text-start font-medium">Languages</th>
            <th className="px-3 py-2 text-start font-medium">Rating</th>
            <th className="px-3 py-2 text-start font-medium">Size</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const queued = queuedVaultIds?.has(item.vaultId) ?? false;
            const hasSystem = item.systemCode !== null;
            const lookup: MetaLookup | null = item.systemCode
              ? { vaultId: item.vaultId, systemCode: item.systemCode, title: item.title }
              : null;
            const downloadDisabled = queued || !hasSystem;
            return (
              <tr
                key={item.vaultId}
                className="border-b border-vault-border/60 transition-colors hover:bg-vault-panel2"
              >
                <td className="px-3 py-2">
                  <GameCover
                    lookup={lookup}
                    enabled={metadataEnabled}
                    onOverride={onOpenOverride}
                    variant="row"
                  />
                </td>
                <td className="max-w-[22rem] truncate px-3 py-2 text-vault-text" title={item.title}>
                  {item.title}
                </td>
                {showSystem && (
                  <td className="px-3 py-2 text-vault-muted">{systemLabel(item.systemCode)}</td>
                )}
                <td className="px-3 py-2">
                  <RegionCell regions={item.regions} />
                </td>
                <td className="px-3 py-2 text-vault-muted">{item.version ?? '—'}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-vault-muted">
                  {item.languages.length > 0 ? item.languages.join(', ') : '—'}
                </td>
                <td className="px-3 py-2 text-vault-muted">{item.rating ?? '—'}</td>
                <td className="px-3 py-2 text-vault-muted">{item.sizeText ?? '—'}</td>
                <td className="px-3 py-2 text-end">
                  <button
                    type="button"
                    disabled={downloadDisabled}
                    title={!hasSystem ? 'Unknown system — cannot download' : undefined}
                    onClick={() => onAdd(item)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      downloadDisabled
                        ? 'cursor-not-allowed bg-vault-panel2 text-vault-muted'
                        : 'bg-vault-accent text-vault-bg hover:brightness-110'
                    }`}
                  >
                    {queued ? 'Queued' : !hasSystem ? 'Unavailable' : 'Download'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
