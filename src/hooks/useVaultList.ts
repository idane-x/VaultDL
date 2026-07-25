import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { ListQuery, MergedPage, MergedRow, SortOrder, SourceId } from '@shared/types';

export interface VaultListParams {
  /** Console to browse. Ignored (and should be null) when `q` is set — search spans consoles. */
  systemCode: string | null;
  /** Global search query (>=3 chars). When set, systemCode is omitted from the request. */
  q: string | null;
  regionId: string;
  sort: string;
  sortOrder: SortOrder;
  /** Enabled sources to query — also included in the query key so toggling a source refetches. */
  sources: SourceId[];
}

export interface UseVaultListResult {
  /** All pages fetched so far, flattened in order. Each row may carry one or both sources. */
  rows: MergedRow[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** True once we know this is a cross-system search (rows carry their own systemCode). */
  isSearch: boolean;
  /** Per-source error messages from the most recently fetched page, if any source failed. */
  errors: Partial<Record<SourceId, string>>;
}

/**
 * Fetches the merged catalog via window.vimm.getList, paginated with react-query's
 * useInfiniteQuery. Browse mode (systemCode set) and search mode (q set, >=3 chars) are
 * mutually exclusive — the caller decides which by what it passes in.
 *
 * Keyed by ['list', systemCode-or-q, regionId, sort, sortOrder, sources] so switching any
 * control (system, search term, region, sort, order, or which sources are enabled) starts a
 * fresh paginated result set.
 */
export function useVaultList(params: VaultListParams): UseVaultListResult {
  const { systemCode, q, regionId, sort, sortOrder, sources } = params;
  const searching = Boolean(q);
  const enabled = (searching ? true : Boolean(systemCode)) && sources.length > 0;

  const sourcesKey = useMemo(() => sources.slice().sort().join(','), [sources]);

  const queryKey = useMemo(
    () =>
      ['list', searching ? `q:${q}` : `sys:${systemCode}`, regionId, sort, sortOrder, sourcesKey] as const,
    [searching, q, systemCode, regionId, sort, sortOrder, sourcesKey],
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }): Promise<MergedPage> => {
      const query: ListQuery = searching
        ? { q, regionId, sort, sortOrder, page: pageParam, sources }
        : { systemCode, regionId, sort, sortOrder, page: pageParam, sources };
      return window.vimm.getList(query);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      Object.values(lastPage.hasMore).some(Boolean) ? lastPage.page + 1 : undefined,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((p) => p.rows) ?? [],
    [query.data],
  );

  const isSearch = query.data?.pages[0]?.isSearch ?? searching;

  const errors = useMemo(() => {
    const pages = query.data?.pages;
    if (!pages || pages.length === 0) return {};
    return pages[pages.length - 1].errors ?? {};
  }, [query.data]);

  const fetchNextPage = useCallback(() => {
    void query.fetchNextPage();
  }, [query]);

  return {
    rows,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage,
    isSearch,
    errors,
  };
}
