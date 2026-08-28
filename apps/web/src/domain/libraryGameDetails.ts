import type {
  IgdbCompany,
  IgdbGameType,
  IgdbNamedEntity,
  IgdbRelease,
  IgdbTimeToBeat,
} from "./igdb";
import type {
  LibraryGameWithArtwork,
  LibraryTrophyCounts,
  PlayStationPlatform,
} from "./libraryGame";

export interface LibraryGameDetailsImage {
  readonly imageId: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface LibraryGameIgdbDetails {
  readonly externalId: string;
  readonly title: string;
  readonly slug: string | null;
  readonly igdbUrl: string | null;
  readonly summary: string | null;
  readonly storyline: string | null;
  readonly platforms: readonly PlayStationPlatform[];
  readonly releaseDate: string | null;
  readonly releases: readonly IgdbRelease[];
  readonly genres: readonly IgdbNamedEntity[];
  readonly gameModes: readonly IgdbNamedEntity[];
  readonly companies: readonly IgdbCompany[];
  readonly collections: readonly IgdbNamedEntity[];
  readonly franchises: readonly IgdbNamedEntity[];
  readonly gameType: IgdbGameType;
  readonly parentGameId: string | null;
  readonly versionTitle: string | null;
  readonly totalRating: number | null;
  readonly totalRatingCount: number;
  readonly timeToBeat: IgdbTimeToBeat | null;
  readonly images: {
    readonly cover: LibraryGameDetailsImage | null;
    readonly screenshots: readonly LibraryGameDetailsImage[];
    readonly artworks: readonly LibraryGameDetailsImage[];
  };
  readonly providerUpdatedAt: string | null;
  readonly fetchedAt: string;
  readonly storedAt: string;
}

export interface LibraryGamePlayStationDetails {
  readonly npCommunicationId: string;
  readonly npServiceName: "trophy" | "trophy2";
  readonly titleName: string;
  readonly platforms: readonly PlayStationPlatform[];
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface LibraryGameTrophySnapshot {
  readonly capturedAt: string;
  readonly earnedTrophies: LibraryTrophyCounts;
  readonly totalTrophies: LibraryTrophyCounts;
  readonly progressPercent: number;
  readonly is100Percent: boolean;
  readonly platinumEarned: boolean;
}

export interface LibraryGameDetails {
  readonly game: LibraryGameWithArtwork;
  readonly igdb: LibraryGameIgdbDetails | null;
  readonly playStation: LibraryGamePlayStationDetails | null;
  readonly trophyHistory: readonly LibraryGameTrophySnapshot[];
}
