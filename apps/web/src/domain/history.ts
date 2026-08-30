import type { PlayStationPlatform, PlayStatus } from "./libraryGame";
import type { PlayStationTrophyCounts } from "./playStation";

export type TrophyHistoryTrophyType = "bronze" | "silver" | "gold" | "platinum";

export interface EarnedTrophyHistoryRecord {
  readonly gameId: string;
  readonly gameTitle: string;
  readonly platform: PlayStationPlatform;
  readonly trophyId: number;
  readonly trophyGroupId: string;
  readonly trophyName: string | null;
  readonly trophyDetail: string | null;
  readonly trophyType: TrophyHistoryTrophyType;
  readonly isSecret: boolean;
  readonly earnedAt: string;
  readonly trophyIconImageId: string | null;
  readonly gameArtworkImageId: string | null;
}

export interface TrophyProgressionEntry extends EarnedTrophyHistoryRecord {
  readonly sequenceNumber: number;
  readonly pointsAwarded: number;
  readonly cumulativeTrophies: PlayStationTrophyCounts;
  readonly cumulativeTrophyCount: number;
  readonly cumulativePoints: number;
  readonly calculatedLevel: number;
  readonly calculatedLevelProgressPercent: number;
}

export type TrophyHistoryMilestoneKind =
  | "trophy_total"
  | "platinum_total"
  | "trophy_level";

export interface TrophyHistoryMilestone {
  readonly id: string;
  readonly kind: TrophyHistoryMilestoneKind;
  readonly value: number;
  readonly achievedAt: string;
  readonly triggeringGameId: string;
  readonly triggeringGameTitle: string;
  readonly triggeringTrophyId: number;
  readonly triggeringTrophyName: string | null;
  readonly triggeringTrophyType: TrophyHistoryTrophyType;
  readonly cumulativeTrophies: PlayStationTrophyCounts;
  readonly cumulativeTrophyCount: number;
  readonly cumulativePoints: number;
  readonly calculatedLevel: number;
  readonly calculatedLevelProgressPercent: number;
}

export interface TrophyHistorySummary {
  readonly oldestEarnedAt: string | null;
  readonly newestEarnedAt: string | null;
  readonly earnedTrophies: PlayStationTrophyCounts;
  readonly earnedTrophyCount: number;
  readonly totalPoints: number;
  readonly calculatedLevel: number;
  readonly calculatedLevelProgressPercent: number;
}

export interface TrophyHistoryProfileSnapshot {
  readonly accountId: string;
  readonly capturedAt: string;
  readonly earnedTrophies: PlayStationTrophyCounts;
}

export interface TrophyHistoryCoverage {
  readonly latestProfileSnapshot: TrophyHistoryProfileSnapshot | null;
  readonly locallyStoredEarnedTrophies: PlayStationTrophyCounts;
  readonly timestampedEarnedTrophies: PlayStationTrophyCounts;
  readonly missingEarnedTrophyTimestamps: PlayStationTrophyCounts;
  readonly missingFromLocalCache: PlayStationTrophyCounts | null;
  readonly missingFromTimeline: PlayStationTrophyCounts | null;
  readonly excessInLocalCache: PlayStationTrophyCounts | null;
  readonly isComplete: boolean | null;
}

export interface TrophyHistoryPlatformStatistic {
  readonly platform: PlayStationPlatform;
  readonly trophyCount: number;
  readonly points: number;
}

export interface TrophyHistoryTypeStatistic {
  readonly trophyType: TrophyHistoryTrophyType;
  readonly trophyCount: number;
  readonly points: number;
}

export interface TrophyHistoryMonthStatistic {
  readonly month: string;
  readonly trophyCount: number;
  readonly points: number;
}

export interface TrophyHistoryStatistics {
  readonly gamesRepresented: number;
  readonly activeMonths: number;
  readonly byPlatform: readonly TrophyHistoryPlatformStatistic[];
  readonly byTrophyType: readonly TrophyHistoryTypeStatistic[];
  readonly monthlyActivity: readonly TrophyHistoryMonthStatistic[];
}

export interface TrophyHistoryOverview {
  readonly summary: TrophyHistorySummary;
  readonly coverage: TrophyHistoryCoverage;
  readonly latestEarnedTrophy: TrophyProgressionEntry | null;
  readonly latestMilestone: TrophyHistoryMilestone | null;
}

export type TrophyHistorySortDirection = "asc" | "desc";

export interface TrophyHistoryPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface TrophyHistoryLogFilters {
  readonly search?: string;
  readonly platform?: PlayStationPlatform;
  readonly trophyType?: TrophyHistoryTrophyType;
  readonly gameId?: string;
  readonly earnedFrom?: string;
  readonly earnedTo?: string;
  readonly direction?: TrophyHistorySortDirection;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface TrophyHistoryLogResult {
  readonly trophies: readonly TrophyProgressionEntry[];
  readonly pagination: TrophyHistoryPagination;
}

export interface TrophyHistoryMilestoneFilters {
  readonly kind?: TrophyHistoryMilestoneKind;
  readonly direction?: TrophyHistorySortDirection;
}

export interface TrophyHistoryMilestoneResult {
  readonly milestones: readonly TrophyHistoryMilestone[];
}

export const backlogHistoryActionKinds = [
  "game_added",
  "game_hidden",
  "game_unhidden",
  "game_deleted",
  "play_status_changed",
  "game_platform_changed",
  "library_reordered",
  "trophy_marked_unobtainable",
  "trophy_restored",
  "collection_created",
  "collection_updated",
  "collection_deleted",
  "collection_pinned",
  "collection_unpinned",
  "collection_membership_changed",
  "collection_reordered",
  "collection_games_reordered",
  "backlog_imported",
  "backlog_deleted",
] as const;

export type BacklogHistoryActionKind =
  (typeof backlogHistoryActionKinds)[number];

export const backlogHistoryActionSources = [
  "user",
  "playstation_sync",
  "portable_import",
  "system",
] as const;

export type BacklogHistoryActionSource =
  (typeof backlogHistoryActionSources)[number];

export type BacklogHistoryDetailValue = null | boolean | number | string;

export interface BacklogHistoryEntry {
  readonly id: string;
  readonly action: BacklogHistoryActionKind;
  readonly source: BacklogHistoryActionSource;
  readonly occurredAt: string;
  readonly gameId: string | null;
  readonly gameTitle: string | null;
  readonly collectionId: string | null;
  readonly collectionName: string | null;
  readonly previousPlayStatus: PlayStatus | null;
  readonly nextPlayStatus: PlayStatus | null;
  readonly summary: string;
  readonly details: Readonly<Record<string, BacklogHistoryDetailValue>>;
}

export interface BacklogHistoryFilters {
  readonly action?: BacklogHistoryActionKind;
  readonly source?: BacklogHistoryActionSource;
  readonly gameId?: string;
  readonly collectionId?: string;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly direction?: TrophyHistorySortDirection;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface BacklogHistoryPageResult {
  readonly entries: readonly BacklogHistoryEntry[];
  readonly pagination: TrophyHistoryPagination;
}
