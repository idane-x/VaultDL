import type { MetaLookup } from '@shared/types';
import { useGameMetaCandidates, useGameMetaOverride } from '../hooks/useGameMeta';

export interface MetaOverrideModalProps {
  /** The game to pick a match for, or null when closed. */
  lookup: MetaLookup | null;
  onClose: () => void;
}

const EMPTY_LOOKUP: MetaLookup = { vaultId: 0, systemCode: '', title: '' };

/** Opened from a cover click: lets the user manually re-point a game at a TheGamesDB match. */
export default function MetaOverrideModal({ lookup, onClose }: MetaOverrideModalProps) {
  const open = lookup !== null;
  const { candidates, isLoading } = useGameMetaCandidates(lookup ?? EMPTY_LOOKUP, open);
  const { override, isPending } = useGameMetaOverride();

  if (!open || !lookup) return null;

  const handlePick = async (candidateId: string) => {
    try {
      await override(lookup, candidateId);
    } catch (err) {
      console.error('Failed to override game meta', err);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-vault-border bg-vault-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-vault-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-vault-text">Choose cover match</h2>
            <p className="truncate text-xs text-vault-muted" title={lookup.title}>
              {lookup.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-vault-muted hover:bg-vault-panel2 hover:text-vault-text"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-vault-muted">
              Searching for matches…
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-vault-muted">
              <span className="text-2xl">🔍</span>
              <span className="text-sm">No alternative matches found</span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handlePick(candidate.id)}
                  className="flex flex-col gap-1 rounded-md border border-vault-border p-1.5 text-start transition-colors hover:border-vault-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden rounded bg-vault-panel2">
                    {candidate.thumbUrl ? (
                      <img
                        src={candidate.thumbUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-vault-muted">
                        <span className="text-xl">🎮</span>
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-vault-text" title={candidate.title}>
                    {candidate.title}
                  </p>
                  <p className="text-[11px] text-vault-muted">{candidate.year ?? '—'}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
