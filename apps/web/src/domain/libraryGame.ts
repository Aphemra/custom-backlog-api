import type { GameResource } from "./gameResource";

export const playStationPlatforms = ["PS3", "PS4", "PS5"] as const;

export type PlayStationPlatform = (typeof playStationPlatforms)[number];

export const playStatuses = [
  "unreleased",
  "not_started",
  "playing",
  "on_hold",
  "waiting",
  "completed",
] as const;

export type PlayStatus = (typeof playStatuses)[number];

export const playStatusLabels: Readonly<Record<PlayStatus, string>> = {
  unreleased: "Unreleased",
  not_started: "Not started",
  playing: "Playing",
  on_hold: "On hold",
  waiting: "Waiting",
  completed: "Completed",
};

export interface LibraryGame {
  readonly id: string;
  readonly title: string;
  readonly sortTitle: string;
  readonly platform: PlayStationPlatform;
  readonly playStatus: PlayStatus;
  readonly isUnobtainable: boolean;
  readonly priorityRank: number;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly hiddenAt: string | null;
}

export interface LibraryTrophyCounts {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}

export interface LibraryTrophySummary {
  readonly progressPercent: number;
  readonly earnedTrophies: LibraryTrophyCounts;
  readonly totalTrophies: LibraryTrophyCounts;
  readonly points: {
    readonly earned: number;
    readonly total: number;
    readonly remaining: number;
  };
  readonly timing: {
    readonly firstTrophy: {
      readonly earnedAt: string | null;
      readonly unavailableReason: "not_earned" | "missing_timestamps" | null;
    };
    readonly platinum: {
      readonly earnedAt: string | null;
      readonly elapsedSinceFirstTrophyMilliseconds: number | null;
      readonly unavailableReason:
        | "not_earned"
        | "not_applicable"
        | "missing_timestamps"
        | "first_trophy_timestamp_missing"
        | null;
    };
    readonly completion: {
      readonly earnedAt: string | null;
      readonly elapsedSinceFirstTrophyMilliseconds: number | null;
      readonly unavailableReason:
        | "not_earned"
        | "not_applicable"
        | "missing_timestamps"
        | "first_trophy_timestamp_missing"
        | null;
    };
  } | null;
  readonly hasPlatinum: boolean;
  readonly platinumEarned: boolean;
  readonly is100Percent: boolean;
  readonly lastSyncedAt: string;
}

export interface LibraryGameWithTrophySummary extends LibraryGame {
  readonly trophySummary: LibraryTrophySummary | null;
}

export interface LibraryGameArtwork {
  readonly imageId: string;
  readonly url: string;
  readonly role: "cover" | "icon" | "background";
}

export interface LibraryGameWithArtwork extends LibraryGameWithTrophySummary {
  readonly artwork: LibraryGameArtwork | null;
}

export interface LibraryGameListItem extends LibraryGameWithArtwork {
  readonly resources: readonly GameResource[];
}

export interface CreateLibraryGameInput {
  readonly title: string;
  readonly platform: PlayStationPlatform;
  readonly playStatus: PlayStatus;
  readonly isUnobtainable: boolean;
  readonly notes: string | null;
}

export type UpdateLibraryGameInput = CreateLibraryGameInput;
