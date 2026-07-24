import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { GameListItem, ListPage, ListQuery, SortOrder } from '@shared/types';

export interface VaultListParams {
  /** Console to browse. Ignored (and should be null) when `q` is set — search spans consoles. */
  systemCode: string | null;
  /** Global search query (>=3 chars). When set, systemCode is omitted from the request. */
  q: string | null;
  regionId: string;
  sort: string;
  sortOrder: SortOrder;
}

export interface UseVaultListResult {
  /** All pages fetched so far, flattened in order. */
  items: GameListItem[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  error: unknown;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** True once we know this is a cross-system search (rows carry their own systemCode). */
  isSearch: boolean;
}

/**
 * Fetches Vimm's advanced-list results via window.vimm.getList, paginated with
 * react-query's useInfiniteQuery. Browse mode (systemCode set) and search mode (q set,
 * >=3 chars) are mutually exclusive — the caller decides which by what it passes in.
 *
 * Keyed by ['list', systemCode-or-q, regionId, sort, sortOrder] so switching any control
 * (system, search term, region, sort, order) starts a fresh paginated result set.
 */
export function useVaultList(params: VaultListParams): UseVaultListResult {
  const { systemCode, q, regionId, sort, sortOrder } = params;
  const searching = Boolean(q);
  const enabled = searching ? true : Boolean(systemCode);

  const queryKey = useMemo(
    () => ['list', searching ? `q:${q}` : `sys:${systemCode}`, regionId, sort, sortOrder] as const,
    [searching, q, systemCode, regionId, sort, sortOrder],
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }): Promise<ListPage> => {
      const query: ListQuery = searching
        ? { q, regionId, sort, sortOrder, page: pageParam }
        : { systemCode, regionId, sort, sortOrder, page: pageParam };
      return window.vimm.getList(query);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const isSearch = query.data?.pages[0]?.isSearch ?? searching;

  const fetchNextPage = useCallback(() => {
    void query.fetchNextPage();
  }, [query]);

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage,
    isSearch,
  };
}
