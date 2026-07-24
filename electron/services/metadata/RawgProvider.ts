/**
 * RAWG client — Metacritic score search. Same failure posture as TgdbProvider: any
 * problem (missing key, non-200, network error) degrades to a null score rather than
 * throwing, so a flaky/unreachable provider never breaks the caller.
 */
import { pickBest } from './match.js';

export interface RawgCandidate {
  /** RAWG game id, stringified. */
  id: string;
  title: string;
  year: string | null;
}

export interface RawgSearchResult {
  metascore: number | null;
  released: string | null;
  /** The RAWG title we matched against, for transparency/debugging. */
  matchedName: string | null;
  candidates: RawgCandidate[];
}

const RAWG_BASE = 'https://api.rawg.io/api';
const MAX_RESULTS = 8;

const EMPTY_RESULT: RawgSearchResult = {
  metascore: null,
  released: null,
  matchedName: null,
  candidates: [],
};

interface RawgGame {
  id: number;
  name: string;
  released?: string | null;
  metacritic?: number | null;
}

interface RawgResponse {
  results?: RawgGame[];
}

/**
 * Search RAWG for `title`, optionally filtered to `platformId`, and pick the
 * best-matching result (via match.ts) for its Metacritic score.
 */
export async function searchScore(
  title: string,
  platformId: number | null,
  apiKey: string | null | undefined,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RawgSearchResult> {
  if (!apiKey || !title.trim()) return EMPTY_RESULT;

  const params = new URLSearchParams({
    key: apiKey,
    search: title,
    search_precise: 'true',
    page_size: String(MAX_RESULTS),
  });
  if (platformId !== null) params.set('platforms', String(platformId));

  const url = `${RAWG_BASE}/games?${params.toString()}`;

  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) return EMPTY_RESULT;

    const body = (await res.json()) as RawgResponse;
    const results = body.results ?? [];

    const candidates: RawgCandidate[] = results.slice(0, MAX_RESULTS).map((g) => ({
      id: String(g.id),
      title: g.name,
      year: g.released ? g.released.slice(0, 4) : null,
    }));

    const best = pickBest(title, results, (g) => g.name);
    if (!best) {
      return { metascore: null, released: null, matchedName: null, candidates };
    }

    return {
      metascore: typeof best.item.metacritic === 'number' ? best.item.metacritic : null,
      released: best.item.released ?? null,
      matchedName: best.item.name,
      candidates,
    };
  } catch (err) {
    console.warn('[RawgProvider] searchScore failed:', err);
    return EMPTY_RESULT;
  }
}
