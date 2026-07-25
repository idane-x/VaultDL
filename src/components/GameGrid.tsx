import type { MergedRow, MetaLookup, SourceId } from '@shared/types';
import { SOURCE_LABELS } from '@shared/types';
import { SYSTEM_BY_CODE } from '@shared/systems';
import GameCover from './GameCover';
import { regionFlagEmoji } from '../lib/format';

const SHORT_SOURCE_LABEL: Record<SourceId, string> = { vimm: 'Vimm', romsfun: 'RomsFun' };

const SOURCE_ORDER: SourceId[] = ['vimm', 'romsfun'];

export interface GameGridProps {
  rows: MergedRow[];
  isLoading: boolean;
  /** Show a small system badge on each card — enabled in global search mode. */
  showSystem: boolean;
  metadataEnabled: boolean;
  /** Which sources have a visible footer button — a disabled source is hidden entirely. */
  enabledSources: Record<SourceId, boolean>;
  onAdd: (row: MergedRow, source: SourceId) => void;
  onOpenOverride: (lookup: MetaLookup) => void;
  /** `${source}:${sourceRef.id}` keys currently present in the download queue. */
  queuedKeys: Set<string>;
}

function systemLabel(systemCode: string | null): string {
  if (!systemCode) return 'Unknown';
  return SYSTEM_BY_CODE[systemCode]?.label ?? systemCode;
}

function SourceButton({
  row,
  source,
  queuedKeys,
  onAdd,
}: {
  row: MergedRow;
  source: SourceId;
  queuedKeys: Set<string>;
  onAdd: (row: MergedRow, source: SourceId) => void;
}) {
  const item = row.sources[source];
  if (!item) {
    return (
      <span
        className="flex-1 rounded-md bg-vault-panel px-2 py-1 text-center text-xs text-vault-muted"
        aria-label={`Not available on ${SOURCE_LABELS[source]}`}
        title={`Not available on ${SOURCE_LABELS[source]}`}
      >
        —
      </span>
    );
  }

  const key = `${source}:${item.sourceRef.id}`;
  const queued = queuedKeys.has(key);
  const unavailable = row.systemCode === null;
  const disabled = queued || unavailable;

  return (
    <button
      type="button"
      disabled={disabled}
      title={unavailable ? 'Unknown system — cannot download' : SHORT_SOURCE_LABEL[source]}
      onClick={() => onAdd(row, source)}
      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-vault-panel text-vault-muted'
          : 'bg-vault-accent text-vault-bg hover:brightness-110'
      }`}
    >
      {queued ? 'Queued' : unavailable ? 'Unavailable' : SHORT_SOURCE_LABEL[source]}
    </button>
  );
}

/** Box-art gallery view of a listing: responsive card grid with cover, title, regions, score, per-source download. */
export default function GameGrid({
  rows,
  isLoading,
  showSystem,
  metadataEnabled,
  enabledSources,
  onAdd,
  onOpenOverride,
  queuedKeys,
}: GameGridProps) {
  const sourceIds = SOURCE_ORDER.filter((s) => enabledSources[s]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-vault-muted">
        Loading listing…
      </div>
    );
  }

  if (rows.length === 0) {
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
        {rows.map((row) => {
          const lookup: MetaLookup | null = row.systemCode
            ? { vaultId: row.sources.vimm?.vaultId ?? 0, systemCode: row.systemCode, title: row.title }
            : null;
          return (
            <div
              key={row.key}
              className="flex flex-col overflow-hidden rounded-lg border border-vault-border bg-vault-panel2 transition-colors hover:border-vault-accent/50"
            >
              <div className="relative">
                <GameCover
                  lookup={lookup}
                  enabled={metadataEnabled}
                  onOverride={onOpenOverride}
                  variant="card"
                />
                {showSystem && (
                  <span className="absolute start-1 top-1 rounded bg-vault-bg/80 px-1.5 py-0.5 text-[10px] font-medium text-vault-text backdrop-blur">
                    {systemLabel(row.systemCode)}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <p
                  className="line-clamp-2 min-h-[2.25rem] text-xs font-medium text-vault-text"
                  title={row.title}
                >
                  {row.title}
                </p>
                <div className="flex items-center gap-1">
                  {row.regions.length > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      title={row.regions.join(', ')}
                    >
                      {row.regions.map((r) => (
                        <span key={r}>{regionFlagEmoji(r)}</span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-xs text-vault-muted">—</span>
                  )}
                </div>
                <div className="mt-auto flex gap-1.5">
                  {sourceIds.map((source) => (
                    <SourceButton
                      key={source}
                      row={row}
                      source={source}
                      queuedKeys={queuedKeys}
                      onAdd={onAdd}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
