import { apiGet } from "./apiClient";

export interface IgdbGameSearchResult {
  id: number;
  name: string;
  platforms: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
}

export interface SearchIgdbGamesResponse {
  query: string;
  count: number;
  games: IgdbGameSearchResult[];
}

export function searchIgdbGames(query: string): Promise<SearchIgdbGamesResponse> {
  const searchParams = new URLSearchParams({
    query,
  });

  return apiGet<SearchIgdbGamesResponse>(`/api/igdb/search?${searchParams.toString()}`);
}
