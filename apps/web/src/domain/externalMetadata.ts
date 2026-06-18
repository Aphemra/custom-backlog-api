import type { IgdbGameSearchResultSource } from "../services/api/igdbApi";

export type TrophyMetadataProvider = "platprices";

export interface GameExternalMetadata {
  igdb?: IgdbGameMetadataSnapshot;
  trophyList?: TrophyListMetadataSnapshot;
}

export interface IgdbGameMetadataSnapshot {
  source?: IgdbGameSearchResultSource;
  igdbId: number;
  name: string;
  platformNames: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
  importedAt: string;
}

export interface TrophyListMetadataSnapshot {
  provider: TrophyMetadataProvider;
  providerGameId: string;
  name: string;
  platformNames: string[];
  trophyCounts: PublicTrophyCounts;
  sourceUrl?: string;
  fetchedAt: string;
}

export interface PublicTrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  total: number;
}
