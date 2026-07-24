import type { QueueItem } from '@shared/types';
import DownloadRow from './DownloadRow';

export interface QueuePanelProps {
  queue: QueueItem[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onClearFinished: () => void;
}

const FINISHED: QueueItem['status'][] = ['done', 'failed', 'canceled'];

/** Right-hand panel: live download queue with per-item progress and controls. */
export default function QueuePanel({
  queue,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onClearFinished,
}: QueuePanelProps) {
  const activeCount = queue.filter((q) => !FINISHED.includes(q.status)).length;
  const finishedCount = queue.filter((q) => FINISHED.includes(q.status)).length;

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-s border-vault-border bg-vault-panel">
      <div className="flex items-center justify-between border-b border-vault-border px-3 py-3">
        <div>
          <div className="text-sm font-semibold text-vault-text">Downloads</div>
          <div className="text-xs text-vault-muted">
            {activeCount} active · {finishedCount} finished
          </div>
        </div>
        <button
          type="button"
          onClick={onClearFinished}
          disabled={finishedCount === 0}
          className={`text-xs font-medium ${
            finishedCount === 0
              ? 'cursor-not-allowed text-vault-muted/50'
              : 'text-vault-accent hover:underline'
          }`}
        >
          Clear finished
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-vault-muted">
            <span className="text-3xl">📥</span>
            <span className="text-sm">No downloads yet — pick a game and hit Download</span>
          </div>
        ) : (
          queue
            .slice()
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((item) => (
              <DownloadRow
                key={item.id}
                item={item}
                onPause={onPause}
                onResume={onResume}
                onCancel={onCancel}
                onRemove={onRemove}
              />
            ))
        )}
      </div>
    </aside>
  );
}
