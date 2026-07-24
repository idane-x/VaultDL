import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { GameMeta, MetaCandidate, MetaLookup } from '@shared/types';

const META_STALE_TIME = 60 * 60 * 1000; // 1 hour
const META_GC_TIME = 24 * 60 * 60 * 1000; // 1 day

export interface UseGameMetaResult {
  meta: GameMeta | undefined;
  isLoading: boolean;
  isFetching: boolean;
}

/**
 * Resolves box art + score for one game via window.vimm.getGameMeta, cached by react-query
 * under ['meta', systemCode, vaultId]. Pass `enabled=false` until the caller actually wants
 * to fetch (e.g. a table row scrolled into view) — this is what keeps bulk listings from
 * firing hundreds of lookups at once.
 */
export function useGameMeta(lookup: MetaLookup, enabled: boolean): UseGameMetaResult {
  const query = useQuery({
    queryKey: ['meta', lookup.systemCode, lookup.vaultId],
    queryFn: () => window.vimm.getGameMeta(lookup),
    enabled,
    staleTime: META_STALE_TIME,
    gcTime: META_GC_TIME,
  });

  return { meta: query.data, isLoading: query.isLoading, isFetching: query.isFetching };
}

export interface UseGameMetaCandidatesResult {
  candidates: MetaCandidate[];
  meta: GameMeta | undefined;
  isLoading: boolean;
}

/** Same as useGameMeta but requests the alternative-match list, for the override modal. */
export function useGameMetaCandidates(
  lookup: MetaLookup,
  enabled: boolean,
): UseGameMetaCandidatesResult {
  const query = useQuery({
    queryKey: ['meta-candidates', lookup.systemCode, lookup.vaultId],
    queryFn: () => window.vimm.getGameMeta(lookup, true),
    enabled,
    staleTime: META_STALE_TIME,
    gcTime: META_GC_TIME,
  });

  return {
    candidates: query.data?.candidates ?? [],
    meta: query.data,
    isLoading: query.isLoading,
  };
}

export interface UseGameMetaOverrideResult {
  override: (lookup: MetaLookup, candidateId: string) => Promise<GameMeta>;
  isPending: boolean;
}

/** Re-points a game's art match at a specific candidate and refreshes both cached queries. */
export function useGameMetaOverride(): UseGameMetaOverrideResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ lookup, candidateId }: { lookup: MetaLookup; candidateId: string }) =>
      window.vimm.overrideGameMeta(lookup, candidateId),
    onSuccess: (meta, { lookup }) => {
      queryClient.setQueryData(['meta', lookup.systemCode, lookup.vaultId], meta);
      queryClient.invalidateQueries({
        queryKey: ['meta-candidates', lookup.systemCode, lookup.vaultId],
      });
    },
  });

  const override = useCallback(
    (lookup: MetaLookup, candidateId: string) => mutation.mutateAsync({ lookup, candidateId }),
    [mutation],
  );

  return { override, isPending: mutation.isPending };
}
