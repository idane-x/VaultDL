/**
 * TheGamesDB client — box-art search. Thin fetch wrapper: every failure mode (missing
 * key, non-200, malformed body, network error) degrades to an empty candidate list rather
 * than throwing, so a flaky/unreachable provider never breaks the caller.
 */

export interface TgdbArtCandidate {
  /** TheGamesDB game id, stringified. */
  id: string;
  title: string;
  year: string | null;
  /** Full-resolution front box-art URL, or null when TGDB has no boxart for this game. */
  boxFrontUrl: string | null;
}

export interface TgdbSearchResult {
  candidates: TgdbArtCandidate[];
}

const TGDB_BASE = 'https://api.thegamesdb.net/v1';
/** Warn once allowance drops below this so a near-exhausted free-tier key is noticeable. */
const LOW_ALLOWANCE_WARNING_THRESHOLD = 25;

interface TgdbGame {
  id: number;
  game_title?: string;
  release_date?: string | null;
}

interface TgdbBoxartEntry {
  id: number;
  type: string;
  side?: string;
  filename: string;
}

interface TgdbResponse {
  code?: number;
  data?: {
    games?: TgdbGame[];
  };
  include?: {
    boxart?: {
      base_url?: { original?: string };
      data?: Record<string, TgdbBoxartEntry[]>;
    };
  };
  remaining_monthly_allowance?: number;
}

/**
 * Search TheGamesDB for box art matching `title`, optionally filtered to `platformId`.
 * Returns every game TGDB found (fields + boxart included), for match.ts to rank.
 */
export async function searchArt(
  title: string,
  platformId: number | null,
  apiKey: string | null | undefined,
  userAgent: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TgdbSearchResult> {
  if (!apiKey || !title.trim()) return { candidates: [] };

  const params = new URLSearchParams({
    apikey: apiKey,
    name: title,
    include: 'boxart',
    fields: 'game_title,release_date,platform',
  });
  if (platformId !== null) params.set('filter[platform]', String(platformId));

  const url = `${TGDB_BASE}/Games/ByGameName?${params.toString()}`;

  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent } });
    if (!res.ok) return { candidates: [] };

    const body = (await res.json()) as TgdbResponse;
    if (!body || body.code !== 200 || !body.data) return { candidates: [] };

    if (
      typeof body.remaining_monthly_allowance === 'number' &&
      body.remaining_monthly_allowance <= LOW_ALLOWANCE_WARNING_THRESHOLD
    ) {
      console.warn(
        `[TgdbProvider] remaining monthly allowance is low: ${body.remaining_monthly_allowance}`,
      );
    }

    const baseUrl = body.include?.boxart?.base_url?.original ?? null;
    const boxartByGame = body.include?.boxart?.data ?? {};
    const games = body.data.games ?? [];

    const candidates: TgdbArtCandidate[] = games.map((g) => {
      const entries = boxartByGame[String(g.id)] ?? [];
      const front = entries.find((e) => e.type === 'boxart' && e.side === 'front');
      const boxFrontUrl = front && baseUrl ? `${baseUrl}${front.filename}` : null;
      return {
        id: String(g.id),
        title: g.game_title ?? '',
        year: g.release_date ? g.release_date.slice(0, 4) : null,
        boxFrontUrl,
      };
    });

    return { candidates };
  } catch (err) {
    console.warn('[TgdbProvider] searchArt failed:', err);
    return { candidates: [] };
  }
}
