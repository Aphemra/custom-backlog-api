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
  pursuitStatus:
    | "unplanned"
    | "pursuing_soon"
    | "in_progress"
    | "paused"
    | "finished"
    | "abandoned";
}
