export interface GameExternalMetadata {
  igdb?: IgdbGameMetadataSnapshot;
}

export interface IgdbGameMetadataSnapshot {
  igdbId: number;
  name: string;
  platformNames: string[];
  firstReleaseYear?: number;
  coverUrl?: string;
  importedAt: string;
}
