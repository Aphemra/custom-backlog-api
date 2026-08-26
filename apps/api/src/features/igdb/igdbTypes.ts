import type { PlayStationPlatform } from "../library/libraryGameTypes.js";

export interface IgdbCredentials {
  clientId: string | null;
  clientSecret: string | null;
}

export interface IgdbGame {
  externalId: string;
  title: string;
  summary: string | null;
  platforms: readonly PlayStationPlatform[];
  releaseDate: string | null;
  coverImageId: string | null;
}

export interface IgdbGameSearchResult extends Omit<IgdbGame, "coverImageId"> {
  cover: {
    imageId: string;
    url: string;
  } | null;
}
