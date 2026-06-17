import type { IgdbGameSearchResultSource } from "../services/api/igdbApi";

export interface GameExternalMetadata {
  igdb?: IgdbGameMetadataSnapshot;
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
