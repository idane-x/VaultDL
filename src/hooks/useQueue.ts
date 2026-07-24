import { useCallback, useEffect, useState } from 'react';
import type { QueueItem } from '@shared/types';

export interface UseQueueResult {
  queue: QueueItem[];
  enqueue: (item: {
    vaultId: number;
    systemCode: string;
    mediaId: number;
    altIndex: number;
    title: string;
    filename: string;
  }) => Promise<QueueItem>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  cancel: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearFinished: () => Promise<void>;
}

/**
 * Keeps a live QueueItem[] in sync with the main process via onQueueChanged/onProgress,
 * seeded from getQueue() on mount. Exposes thin wrappers over the window.vimm queue API.
 */
export function useQueue(): UseQueueResult {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    window.vimm.getQueue().then((initial) => {
      if (!cancelled) setQueue(initial);
    });

    const unsubQueueChanged = window.vimm.onQueueChanged((next) => {
      setQueue(next);
    });

    const unsubProgress = window.vimm.onProgress((p) => {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? {
                ...item,
                status: p.status,
                progress: p.progress,
                receivedBytes: p.receivedBytes,
                totalBytes: p.totalBytes,
                speed: p.speed,
                error: p.error ?? null,
              }
            : item,
        ),
      );
    });

    return () => {
      cancelled = true;
      unsubQueueChanged();
      unsubProgress();
    };
  }, []);

  const enqueue = useCallback((item: Parameters<UseQueueResult['enqueue']>[0]) => {
    return window.vimm.enqueue(item);
  }, []);

  const pause = useCallback((id: string) => window.vimm.pauseItem(id), []);
  const resume = useCallback((id: string) => window.vimm.resumeItem(id), []);
  const cancel = useCallback((id: string) => window.vimm.cancelItem(id), []);
  const remove = useCallback((id: string) => window.vimm.removeItem(id), []);
  const clearFinished = useCallback(() => window.vimm.clearFinished(), []);

  return { queue, enqueue, pause, resume, cancel, remove, clearFinished };
}
