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

  if (searchMode === "real") {
    return {
      source: "igdb",
      games: await searchRealIgdbGames(input),
    };
  }

  return {
    source: "mock",
    games: searchMockIgdbGames(input),
  };
}
