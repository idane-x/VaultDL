import type { GameListItem, MetaLookup } from '@shared/types';
import GameCover from './GameCover';
import { regionFlagEmoji } from '../lib/format';

export interface GameGridProps {
  items: GameListItem[];
  isLoading: boolean;
  systemCode: string;
  metadataEnabled: boolean;
  onAdd: (item: GameListItem) => void;
  onOpenOverride: (lookup: MetaLookup) => void;
  /** vaultIds currently present in the download queue, to disable/relabel the button. */
  queuedVaultIds?: Set<number>;
}

/** Box-art gallery view of a listing: responsive card grid with cover, title, regions, score, download. */
export default function GameGrid({
  items,
  isLoading,
  systemCode,
  metadataEnabled,
  onAdd,
  onOpenOverride,
  queuedVaultIds,
}: GameGridProps) {
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
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {items.map((item) => {
          const queued = queuedVaultIds?.has(item.vaultId) ?? false;
          const lookup: MetaLookup = { vaultId: item.vaultId, systemCode, title: item.title };
          return (
            <div
              key={item.vaultId}
              className="flex flex-col overflow-hidden rounded-lg border border-vault-border bg-vault-panel2 transition-colors hover:border-vault-accent/50"
            >
              <GameCover
                lookup={lookup}
                enabled={metadataEnabled}
                onOverride={onOpenOverride}
                variant="card"
              />
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <p
                  className="line-clamp-2 min-h-[2.25rem] text-xs font-medium text-vault-text"
                  title={item.title}
                >
                  {item.title}
                </p>
                <div className="flex items-center gap-1">
                  {item.regions.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      title={item.regions.join(', ')}
                    >
                      {item.regions.map((r) => (
                        <span key={r}>{regionFlagEmoji(r)}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-vault-muted">—</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={queued}
                  onClick={() => onAdd(item)}
                  className={`mt-auto rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    queued
                      ? 'cursor-not-allowed bg-vault-panel text-vault-muted'
                      : 'bg-vault-accent text-vault-bg hover:brightness-110'
                  }`}
                >
                  {queued ? 'Queued' : 'Download'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
