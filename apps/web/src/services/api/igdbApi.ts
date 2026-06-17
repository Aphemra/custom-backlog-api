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

export interface IgdbIntegrationStatus {
  provider: "igdb";
  configured: boolean;
  realSearchEnabled: boolean;
  missingEnvVars: string[];
  message: string;
}

export function searchIgdbGames(query: string): Promise<SearchIgdbGamesResponse> {
  const searchParams = new URLSearchParams({
    query,
  });

  return apiGet<SearchIgdbGamesResponse>(`/api/igdb/search?${searchParams.toString()}`);
}

export function getIgdbIntegrationStatus(): Promise<IgdbIntegrationStatus> {
  return apiGet<IgdbIntegrationStatus>("/api/igdb/status");
}
