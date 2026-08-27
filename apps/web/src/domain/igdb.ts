import type {
  LibraryGame,
  PlayStationPlatform,
  PursuitStatus,
} from "./libraryGame";

export interface IgdbGameSearchResult {
  readonly externalId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly platforms: readonly PlayStationPlatform[];
  readonly releaseDate: string | null;
  readonly isDlc: boolean;
  readonly cover: {
    readonly imageId: string;
    readonly url: string;
  } | null;
}

export interface AddIgdbGameInput {
  readonly platform: PlayStationPlatform;
  readonly pursuitStatus: PursuitStatus;
}

export interface AddedIgdbGame {
  readonly game: LibraryGame;
  readonly externalId: string;
}

export interface IgdbEnrichmentResult {
  readonly game: LibraryGame;
  readonly metadata: {
    readonly provider: "igdb";
    readonly externalId: string;
    readonly title: string;
    readonly releaseDate: string | null;
    readonly cover: {
      readonly imageId: string;
      readonly url: string;
    } | null;
  };
}
