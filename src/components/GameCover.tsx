import type { MetaLookup } from '@shared/types';
import { useGameMeta } from '../hooks/useGameMeta';
import { useInView } from '../hooks/useInView';
import { scoreColor } from '../lib/format';

export interface GameCoverProps {
  /** Null when the row has no known systemCode — metadata can't be looked up for it. */
  lookup: MetaLookup | null;
  /** Master metadata toggle from Settings — when false, renders a static placeholder and never fetches. */
  enabled: boolean;
  /** Called with this game's lookup when the cover is clicked, to open the override modal. */
  onOverride: (lookup: MetaLookup) => void;
  /** 'row' = small fixed size for table cells, 'card' = fills its grid cell at 3:4. */
  variant?: 'row' | 'card';
}

/**
 * A single game's cover thumbnail + score badge. Only fetches metadata once it has
 * scrolled into view (IntersectionObserver via useInView), so bulk listings don't fire
 * a lookup per row on mount. Clicking opens the manual-match override modal.
 *
 * When `lookup` is null (row's systemCode is unknown, e.g. an unparsed search result),
 * always renders the static placeholder and never fetches or opens the override modal.
 */
export default function GameCover({ lookup, enabled, onOverride, variant = 'row' }: GameCoverProps) {
  const { ref, inView } = useInView<HTMLButtonElement>({ rootMargin: '200px' });
  const canFetch = enabled && lookup !== null;
  const effectiveLookup: MetaLookup = lookup ?? { vaultId: 0, systemCode: '', title: '' };
  const { meta, isLoading } = useGameMeta(effectiveLookup, canFetch && inView);

  const hasArt = canFetch && meta?.status === 'ok' && Boolean(meta.boxArtUrl);
  const showScore =
    canFetch && meta?.status === 'ok' && meta.metascore !== null && meta.metascore !== undefined;
  const pending = canFetch && inView && (isLoading || meta?.status === 'loading');

  const sizeClasses = variant === 'row' ? 'h-11 w-8' : 'aspect-[3/4] w-full';
  const placeholderTextClasses = variant === 'row' ? 'text-xs' : 'text-3xl';

  return (
    <button
      type="button"
      ref={ref}
      onClick={() => {
        if (enabled && lookup) onOverride(lookup);
      }}
      disabled={!canFetch}
      title={
        lookup === null
          ? 'Unknown system — metadata unavailable'
          : enabled
            ? `${lookup.title} — click to change cover match`
            : undefined
      }
      className={`relative shrink-0 overflow-hidden rounded-md border border-vault-border bg-vault-panel2 ${sizeClasses} ${
        canFetch ? 'cursor-pointer transition-colors hover:border-vault-accent/60' : 'cursor-default'
      }`}
    >
      {hasArt ? (
        <img src={meta!.boxArtUrl!} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-vault-muted ${
            pending ? 'animate-pulse' : ''
          }`}
        >
          <span className={placeholderTextClasses}>🎮</span>
        </div>
      )}
      {showScore && (
        <span
          className={`absolute bottom-0.5 end-0.5 rounded px-1 text-[10px] font-semibold leading-tight ${scoreColor(
            meta!.metascore,
          )}`}
        >
          {meta!.metascore}
        </span>
      )}
    </button>
  );
}
