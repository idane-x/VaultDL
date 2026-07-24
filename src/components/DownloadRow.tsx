import type { QueueItem } from '@shared/types';
import { formatBytes, formatSpeed } from '../lib/format';

export interface DownloadRowProps {
  item: QueueItem;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_LABEL: Record<QueueItem['status'], string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  extracting: 'Extracting',
  done: 'Done',
  failed: 'Failed',
  paused: 'Paused',
  canceled: 'Canceled',
};

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  queued: 'text-vault-muted',
  downloading: 'text-vault-accent',
  extracting: 'text-vault-accent2',
  done: 'text-vault-accent2',
  failed: 'text-red-400',
  paused: 'text-yellow-400',
  canceled: 'text-vault-muted',
};

/** One queue item: title, status, progress bar, speed, and action buttons. */
export default function DownloadRow({ item, onPause, onResume, onCancel, onRemove }: DownloadRowProps) {
  const active = item.status === 'downloading' || item.status === 'extracting';
  const finished = item.status === 'done' || item.status === 'failed' || item.status === 'canceled';
  const pct = Math.round(Math.min(1, Math.max(0, item.progress)) * 100);

  return (
    <div className="rounded-lg border border-vault-border bg-vault-panel2 p-2.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-vault-text" title={item.title}>
            {item.title}
          </div>
          <div className={`text-xs ${STATUS_COLOR[item.status]}`}>
            {STATUS_LABEL[item.status]}
            {item.status === 'failed' && item.error ? `: ${item.error}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.status === 'downloading' && (
            <button
              type="button"
              title="Pause"
              onClick={() => onPause(item.id)}
              className="rounded-md p-1 text-vault-muted hover:bg-vault-panel hover:text-vault-text"
            >
              ⏸️
            </button>
          )}
          {item.status === 'paused' && (
            <button
              type="button"
              title="Resume"
              onClick={() => onResume(item.id)}
              className="rounded-md p-1 text-vault-muted hover:bg-vault-panel hover:text-vault-text"
            >
              ▶️
            </button>
          )}
          {!finished && (
            <button
              type="button"
              title="Cancel"
              onClick={() => onCancel(item.id)}
              className="rounded-md p-1 text-vault-muted hover:bg-vault-panel hover:text-red-400"
            >
              ✕
            </button>
          )}
          {finished && (
            <button
              type="button"
              title="Remove"
              onClick={() => onRemove(item.id)}
              className="rounded-md p-1 text-vault-muted hover:bg-vault-panel hover:text-vault-text"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-vault-border">
        <div
          className={`h-full rounded-full transition-all ${
            item.status === 'failed' ? 'bg-red-400' : 'bg-vault-accent'
          }`}
          style={{ width: `${item.status === 'done' ? 100 : pct}%` }}
        />
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-vault-muted">
        <span>
          {formatBytes(item.receivedBytes)}
          {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ''}
        </span>
        <span>{active ? formatSpeed(item.speed) : `${pct}%`}</span>
      </div>
    </div>
  );
}
