import type { GameListItem, MergedRow, MetaLookup, SourceId } from '@shared/types';
import { SOURCE_LABELS } from '@shared/types';
import { SYSTEM_BY_CODE } from '@shared/systems';
import GameCover from './GameCover';
import { regionFlagEmoji } from '../lib/format';

/** Short column/button labels — SOURCE_LABELS full names ("Vimm's Lair") are too long for a header. */
const SHORT_SOURCE_LABEL: Record<SourceId, string> = { vimm: 'Vimm', romsfun: 'RomsFun' };

const SOURCE_ORDER: SourceId[] = ['vimm', 'romsfun'];

export interface GameTableProps {
  rows: MergedRow[];
  isLoading: boolean;
  /** Show a System column — enabled in global search mode where rows span consoles. */
  showSystem: boolean;
  metadataEnabled: boolean;
  /** Which sources have a visible column — a disabled source's column is hidden entirely. */
  enabledSources: Record<SourceId, boolean>;
  onAdd: (row: MergedRow, source: SourceId) => void;
  onOpenOverride: (lookup: MetaLookup) => void;
  /** `${source}:${sourceRef.id}` keys currently present in the download queue. */
  queuedKeys: Set<string>;
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

function SourceCell({
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
        className="text-vault-muted"
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
      title={unavailable ? 'Unknown system — cannot download' : undefined}
      onClick={() => onAdd(row, source)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-vault-panel2 text-vault-muted'
          : 'bg-vault-accent text-vault-bg hover:brightness-110'
      }`}
    >
      {queued ? 'Queued' : unavailable ? 'Unavailable' : 'Download'}
    </button>
  );
}

/** Renders a listing as a table with a per-row, per-source download action. Handles loading/empty states. */
export default function GameTable({
  rows,
  isLoading,
  showSystem,
  metadataEnabled,
  enabledSources,
  onAdd,
  onOpenOverride,
  queuedKeys,
}: GameTableProps) {
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
            {sourceIds.map((source) => (
              <th key={source} className="px-3 py-2 text-end font-medium">
                {SHORT_SOURCE_LABEL[source]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lookup: MetaLookup | null = row.systemCode
              ? { vaultId: row.sources.vimm?.vaultId ?? 0, systemCode: row.systemCode, title: row.title }
              : null;
            return (
              <tr
                key={row.key}
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
                <td className="max-w-[22rem] truncate px-3 py-2 text-vault-text" title={row.title}>
                  {row.title}
                </td>
                {showSystem && (
                  <td className="px-3 py-2 text-vault-muted">{systemLabel(row.systemCode)}</td>
                )}
                <td className="px-3 py-2">
                  <RegionCell regions={row.regions} />
                </td>
                <td className="px-3 py-2 text-vault-muted">{row.version ?? '—'}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-vault-muted">
                  {row.languages.length > 0 ? row.languages.join(', ') : '—'}
                </td>
                <td className="px-3 py-2 text-vault-muted">{row.rating ?? '—'}</td>
                <td className="px-3 py-2 text-vault-muted">{row.sizeText ?? '—'}</td>
                {sourceIds.map((source) => (
                  <td key={source} className="px-3 py-2 text-end">
                    <SourceCell row={row} source={source} queuedKeys={queuedKeys} onAdd={onAdd} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
