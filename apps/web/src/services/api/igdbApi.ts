import { apiGet } from "./apiClient";

export type IgdbGameSearchResultSource = "mock" | "igdb";
export type IgdbSearchMode = "mock" | "real";

export interface IgdbGameSearchResult {
  id: number;
  name: string;
  platforms: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
  source: IgdbGameSearchResultSource;
}

export interface SearchIgdbGamesResponse {
  query: string;
  source: IgdbGameSearchResultSource;
  count: number;
  games: IgdbGameSearchResult[];
}

export interface IgdbIntegrationStatus {
  provider: "igdb";
  configured: boolean;
  searchMode: IgdbSearchMode;
  realSearchEnabled: boolean;
  authStrategy: "twitch_client_credentials";
  missingEnvVars: string[];
  message: string;
}

export function searchIgdbGames(query: string, limit = 10): Promise<SearchIgdbGamesResponse> {
  const searchParams = new URLSearchParams({
    query,
    limit: limit.toString(),
  });

  return apiGet<SearchIgdbGamesResponse>(`/api/igdb/search?${searchParams.toString()}`);
}

export function getIgdbIntegrationStatus(): Promise<IgdbIntegrationStatus> {
  return apiGet<IgdbIntegrationStatus>("/api/igdb/status");
}
