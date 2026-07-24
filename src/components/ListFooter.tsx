export interface ListFooterProps {
  totalLoaded: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/** Pagination footer under the listing: loaded count, "Load more", and end-of-results state. */
export default function ListFooter({
  totalLoaded,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ListFooterProps) {
  if (totalLoaded === 0) return null;

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-vault-border bg-vault-panel px-4 py-2.5 text-xs text-vault-muted">
      <span>{totalLoaded} loaded</span>
      {hasNextPage ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="rounded-md border border-vault-border bg-vault-panel2 px-3 py-1 text-xs font-medium text-vault-text transition-colors hover:border-vault-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      ) : (
        <span>No more results</span>
      )}
    </div>
  );
}
