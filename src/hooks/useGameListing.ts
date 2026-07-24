import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { GameListItem } from '@shared/types';

export interface UseGameListingResult {
  items: GameListItem[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  /** Re-fetch, bypassing the main-process listing cache. */
  refetchForce: () => void;
}

/** Fetches a system+letter listing page via window.vimm.getListing, cached by react-query. */
export function useGameListing(
  systemCode: string | null,
  letter: string | null,
): UseGameListingResult {
  const queryClient = useQueryClient();
  const enabled = Boolean(systemCode && letter);

  const query = useQuery({
    queryKey: ['listing', systemCode, letter],
    queryFn: () => window.vimm.getListing(systemCode as string, letter as string, false),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const refetchForce = useCallback(() => {
    if (!systemCode || !letter) return;
    queryClient
      .fetchQuery({
        queryKey: ['listing', systemCode, letter],
        queryFn: () => window.vimm.getListing(systemCode, letter, true),
      })
      .catch(() => undefined);
  }, [queryClient, systemCode, letter]);

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetchForce,
  };
}
