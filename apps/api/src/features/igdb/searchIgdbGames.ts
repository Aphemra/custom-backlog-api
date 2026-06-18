import { filterIgdbSearchResultsToBaseGameCandidates } from "./filterIgdbSearchResultsToBaseGameCandidates.js";
import { filterIgdbSearchResultsToSonyConsoles } from "./filterIgdbSearchResultsToSonyConsoles.js";
import { getIgdbSearchMode } from "./igdbConfig.js";
import type { IgdbGameSearchResult, IgdbGameSearchResultSource } from "./igdbSearchTypes.js";
import { searchMockIgdbGames } from "./searchMockIgdbGames.js";
import { searchRealIgdbGames } from "./searchRealIgdbGames.js";

export interface SearchIgdbGamesInput {
  query: string;
  limit?: number;
}

export interface SearchIgdbGamesResult {
  source: IgdbGameSearchResultSource;
  games: IgdbGameSearchResult[];
}

export async function searchIgdbGames(input: SearchIgdbGamesInput): Promise<SearchIgdbGamesResult> {
  const searchMode = getIgdbSearchMode();
  const finalLimit = getFinalLimit(input.limit);
  const candidateLimit = getCandidateLimit(finalLimit);

  if (searchMode === "real") {
    const games = await searchRealIgdbGames({
      query: input.query,
      limit: candidateLimit,
    });

    const baseGameCandidates = filterIgdbSearchResultsToBaseGameCandidates(games);

    return {
      source: "igdb",
      games: filterIgdbSearchResultsToSonyConsoles(baseGameCandidates, finalLimit),
    };
  }

  const games = searchMockIgdbGames({
    query: input.query,
    limit: candidateLimit,
  });

  const baseGameCandidates = filterIgdbSearchResultsToBaseGameCandidates(games);

  return {
    source: "mock",
    games: filterIgdbSearchResultsToSonyConsoles(baseGameCandidates, finalLimit),
  };
}

function getFinalLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit)) {
    return 10;
  }

  if (limit < 1) {
    return 1;
  }

  if (limit > 25) {
    return 25;
  }

  return limit;
}

function getCandidateLimit(finalLimit: number): number {
  return Math.min(finalLimit * 4, 50);
}
