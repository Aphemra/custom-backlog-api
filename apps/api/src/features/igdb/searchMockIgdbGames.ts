import { mockIgdbGames } from "./mockIgdbGames.js";
import type { IgdbGameSearchResult } from "./igdbSearchTypes.js";

export interface SearchMockIgdbGamesInput {
  query: string;
  limit?: number;
}

export function searchMockIgdbGames({ query, limit = 10 }: SearchMockIgdbGamesInput): IgdbGameSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return mockIgdbGames.filter((game) => game.name.toLowerCase().includes(normalizedQuery)).slice(0, limit);
}
