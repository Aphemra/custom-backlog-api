import type {
  LibraryGame,
  PlayStationPlatform,
  PlayStatus,
} from "./libraryGame";

export const igdbSearchScopes = [
  "games",
  "editions",
  "dlc",
  "expansions",
  "packs",
  "updates",
  "all",
] as const;

export type IgdbSearchScope = (typeof igdbSearchScopes)[number];

export const igdbSearchScopeLabels: Readonly<Record<IgdbSearchScope, string>> =
  {
    games: "Games only",
    editions: "Games + editions and bundles",
    dlc: "Games + DLC",
    expansions: "Games + expansions",
    packs: "Games + packs",
    updates: "Games + updates",
    all: "Everything",
  };

export interface IgdbSearchOptions {
  readonly platform: PlayStationPlatform | null;
  readonly scope: IgdbSearchScope;
}

export interface IgdbNamedEntity {
  readonly externalId: string;
  readonly name: string;
}

export interface IgdbImageReference {
  readonly imageId: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface IgdbRelease {
  readonly platform: PlayStationPlatform;
  readonly releaseDate: string;
}

export interface IgdbCompany {
  readonly externalId: string;
  readonly name: string;
  readonly developer: boolean;
  readonly publisher: boolean;
}

export interface IgdbGameType {
  readonly externalId: string;
  readonly name: string | null;
}

export interface IgdbTimeToBeat {
  readonly hastilySeconds: number | null;
  readonly normallySeconds: number | null;
  readonly completelySeconds: number | null;
  readonly submissionCount: number;
}

export interface IgdbGameSearchResult {
  readonly externalId: string;
  readonly title: string;
  readonly slug: string | null;
  readonly igdbUrl: string | null;
  readonly summary: string | null;
  readonly storyline: string | null;
  readonly platforms: readonly PlayStationPlatform[];
  readonly releaseDate: string | null;
  readonly releases: readonly IgdbRelease[];
  readonly screenshots: readonly IgdbImageReference[];
  readonly artworks: readonly IgdbImageReference[];
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
  readonly providerUpdatedAt: string | null;
  readonly isDlc: boolean;
  readonly cover: {
    readonly imageId: string;
    readonly url: string;
  } | null;
}

export interface AddIgdbGameInput {
  readonly platform: PlayStationPlatform;
  readonly playStatus: PlayStatus;
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
