import type {
  PlayStationPlatform,
  PlayStatus,
} from "../library/libraryGameTypes.js";
import type {
  PlayStationTrophyCounts,
  PlayStationTrophyType,
} from "../playstation/playStationTypes.js";

export interface EarnedTrophyHistoryRecord {
  readonly gameId: string;
  readonly gameTitle: string;
  readonly platform: PlayStationPlatform;
  readonly trophyId: number;
  readonly trophyGroupId: string;
  readonly trophyName: string | null;
  readonly trophyDetail: string | null;
  readonly trophyType: PlayStationTrophyType;
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

export const trophyHistoryMilestoneKinds = [
  "trophy_total",
  "platinum_total",
  "trophy_level",
] as const;

export type TrophyHistoryMilestoneKind =
  (typeof trophyHistoryMilestoneKinds)[number];

export interface TrophyHistoryMilestone {
  readonly id: string;
  readonly kind: TrophyHistoryMilestoneKind;
  readonly value: number;
  readonly achievedAt: string;
  readonly triggeringGameId: string;
  readonly triggeringGameTitle: string;
  readonly triggeringTrophyId: number;
  readonly triggeringTrophyName: string | null;
  readonly triggeringTrophyType: PlayStationTrophyType;
  readonly cumulativeTrophies: PlayStationTrophyCounts;
  readonly cumulativeTrophyCount: number;
  readonly cumulativePoints: number;
  readonly calculatedLevel: number;
  readonly calculatedLevelProgressPercent: number;
}

export interface TrophyHistoryTimeline {
  readonly entries: readonly TrophyProgressionEntry[];
  readonly milestones: readonly TrophyHistoryMilestone[];
  readonly summary: {
    readonly oldestEarnedAt: string | null;
    readonly newestEarnedAt: string | null;
    readonly earnedTrophies: PlayStationTrophyCounts;
    readonly earnedTrophyCount: number;
    readonly totalPoints: number;
    readonly calculatedLevel: number;
    readonly calculatedLevelProgressPercent: number;
  };
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

export interface TrophyHistoryResult {
  readonly timeline: TrophyHistoryTimeline;
  readonly coverage: TrophyHistoryCoverage;
}

export const trophyHistorySortDirections = ["asc", "desc"] as const;

export type TrophyHistorySortDirection =
  (typeof trophyHistorySortDirections)[number];

export interface TrophyHistoryPlatformStatistic {
  readonly platform: PlayStationPlatform;
  readonly trophyCount: number;
  readonly points: number;
}

export interface TrophyHistoryTypeStatistic {
  readonly trophyType: PlayStationTrophyType;
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
  readonly summary: TrophyHistoryTimeline["summary"];
  readonly coverage: TrophyHistoryCoverage;
  readonly latestEarnedTrophy: TrophyProgressionEntry | null;
  readonly latestMilestone: TrophyHistoryMilestone | null;
}

export interface TrophyHistoryLogQuery {
  readonly search: string | null;
  readonly platform: PlayStationPlatform | null;
  readonly trophyType: PlayStationTrophyType | null;
  readonly gameId: string | null;
  readonly earnedFrom: string | null;
  readonly earnedTo: string | null;
  readonly direction: TrophyHistorySortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export interface TrophyHistoryPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface TrophyHistoryLogResult {
  readonly trophies: readonly TrophyProgressionEntry[];
  readonly pagination: TrophyHistoryPagination;
}

export interface TrophyHistoryMilestoneQuery {
  readonly kind: TrophyHistoryMilestoneKind | null;
  readonly direction: TrophyHistorySortDirection;
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

export interface CreateBacklogHistoryEntryInput {
  readonly action: BacklogHistoryActionKind;
  readonly source: BacklogHistoryActionSource;
  readonly occurredAt?: string;
  readonly gameId?: string | null;
  readonly gameTitle?: string | null;
  readonly collectionId?: string | null;
  readonly collectionName?: string | null;
  readonly previousPlayStatus?: PlayStatus | null;
  readonly nextPlayStatus?: PlayStatus | null;
  readonly summary: string;
  readonly details?: Readonly<Record<string, BacklogHistoryDetailValue>>;
}

export interface BacklogHistoryListFilters {
  readonly action?: BacklogHistoryActionKind;
  readonly source?: BacklogHistoryActionSource;
  readonly gameId?: string;
  readonly collectionId?: string;
  readonly occurredFrom?: string;
  readonly occurredTo?: string;
  readonly direction?: TrophyHistorySortDirection;
  readonly limit?: number;
  readonly offset?: number;
}

export interface BacklogHistoryListResult {
  readonly entries: readonly BacklogHistoryEntry[];
  readonly totalItems: number;
}

export interface BacklogHistoryQuery {
  readonly action: BacklogHistoryActionKind | null;
  readonly source: BacklogHistoryActionSource | null;
  readonly gameId: string | null;
  readonly collectionId: string | null;
  readonly occurredFrom: string | null;
  readonly occurredTo: string | null;
  readonly direction: TrophyHistorySortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export interface BacklogHistoryPageResult {
  readonly entries: readonly BacklogHistoryEntry[];
  readonly pagination: TrophyHistoryPagination;
}
