import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";

export interface IgdbCredentials {
  clientId: string | null;
  clientSecret: string | null;
}

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

export interface IgdbSearchOptions {
  readonly platform: PlayStationPlatform | null;
  readonly scope: IgdbSearchScope;
}

export interface IgdbNamedEntity {
  externalId: string;
  name: string;
}

export interface IgdbImageReference {
  imageId: string;
  width: number | null;
  height: number | null;
}

export interface IgdbRelease {
  platform: PlayStationPlatform;
  releaseDate: string;
}

export interface IgdbCompany {
  externalId: string;
  name: string;
  developer: boolean;
  publisher: boolean;
}

export interface IgdbGameType {
  externalId: string;
  name: string | null;
}

export interface IgdbTimeToBeat {
  hastilySeconds: number | null;
  normallySeconds: number | null;
  completelySeconds: number | null;
  submissionCount: number;
}

export interface IgdbGame {
  externalId: string;
  title: string;
  slug: string | null;
  igdbUrl: string | null;
  summary: string | null;
  storyline: string | null;
  platforms: readonly PlayStationPlatform[];
  releaseDate: string | null;
  releases: readonly IgdbRelease[];
  coverImageId: string | null;
  screenshots: readonly IgdbImageReference[];
  artworks: readonly IgdbImageReference[];
  genres: readonly IgdbNamedEntity[];
  gameModes: readonly IgdbNamedEntity[];
  companies: readonly IgdbCompany[];
  collections: readonly IgdbNamedEntity[];
  franchises: readonly IgdbNamedEntity[];
  gameType: IgdbGameType;
  parentGameId: string | null;
  versionTitle: string | null;
  totalRating: number | null;
  totalRatingCount: number;
  timeToBeat: IgdbTimeToBeat | null;
  providerUpdatedAt: string | null;
  isDlc: boolean;
  payload: Readonly<Record<string, unknown>>;
}

export interface IgdbGameSearchResult extends Omit<
  IgdbGame,
  "coverImageId" | "payload"
> {
  cover: {
    imageId: string;
    url: string;
  } | null;
}

export interface AddIgdbGameInput {
  externalId: string;
  platform: PlayStationPlatform;
  playStatus: PlayStatus;
}
