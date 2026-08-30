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

/**
 * Historical vocabulary retained for v1-v3 portable-data imports and the
 * legacy SQLite columns that remain in the local database.
 */
export const pursuitStatuses = [
  "unplanned",
  "pursuing_soon",
  "in_progress",
  "paused",
  "finished",
  "abandoned",
] as const;

export type PursuitStatus = (typeof pursuitStatuses)[number];

export function migratePursuitStatus(status: PursuitStatus): PlayStatus {
  switch (status) {
    case "in_progress":
      return "playing";

    case "paused":
    case "abandoned":
      return "on_hold";

    case "finished":
      return "completed";

    case "unplanned":
    case "pursuing_soon":
      return "not_started";
  }
}

export function createCompatiblePursuitStatus(
  status: PlayStatus,
): PursuitStatus {
  switch (status) {
    case "playing":
      return "in_progress";

    case "on_hold":
    case "waiting":
      return "paused";

    case "completed":
      return "finished";

    case "unreleased":
    case "not_started":
      return "unplanned";
  }
}

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

export interface LibraryTrophyAvailabilitySummary {
  readonly attainableTrophies: LibraryTrophyCounts;
  readonly unobtainableTrophies: LibraryTrophyCounts;
  readonly attainablePoints: number;
  readonly unobtainablePoints: number;
  readonly attainableProgressPercent: number;
  readonly earnedProgressSharePercent: number;
  readonly unobtainableProgressSharePercent: number;
  readonly isMaxAttainable: boolean;
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
  readonly availability: LibraryTrophyAvailabilitySummary;
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

export interface LibraryGameViewAlert {
  readonly kind: "new_trophies" | "completion_lost";
  readonly status: "unread" | "read" | "resolved" | "dismissed";
  readonly createdAt: string;
}

export interface LibraryGameViewData {
  readonly collectionIds: readonly string[];
  readonly hasPlayStationLink: boolean;
  readonly alerts: readonly LibraryGameViewAlert[];
}

export interface CreateLibraryGameInput {
  readonly title: string;
  readonly platform: PlayStationPlatform;
  readonly playStatus?: PlayStatus;
  readonly isUnobtainable?: boolean;
  readonly notes?: string | null;
}

export interface UpdateLibraryGameInput {
  readonly title?: string;
  readonly platform?: PlayStationPlatform;
  readonly playStatus?: PlayStatus;
  readonly isUnobtainable?: boolean;
  readonly notes?: string | null;
}
