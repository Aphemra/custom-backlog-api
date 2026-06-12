import { mockIgdbGames, type MockIgdbGame } from "./mockIgdbGames.js";

export interface SearchMockIgdbGamesInput {
  query: string;
  limit?: number;
}

export function searchMockIgdbGames({ query, limit = 10 }: SearchMockIgdbGamesInput): MockIgdbGame[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return mockIgdbGames.filter((game) => game.name.toLowerCase().includes(normalizedQuery)).slice(0, limit);
}
