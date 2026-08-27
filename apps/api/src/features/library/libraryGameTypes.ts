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

export interface LibraryTrophySummary {
  readonly progressPercent: number;
  readonly earnedTrophies: LibraryTrophyCounts;
  readonly totalTrophies: LibraryTrophyCounts;
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
