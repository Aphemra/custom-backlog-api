import type {
  LibraryGame,
  PlayStationPlatform,
  PlayStatus,
} from "./libraryGame";

export type PlayStationServiceName = "trophy" | "trophy2";

export type PlayStationReconciliationStatus =
  | "linked"
  | "suggested_match"
  | "ambiguous"
  | "new";

export interface PlayStationConnectionStatus {
  readonly configured: boolean;
  readonly readerOnlineId: string | null;
  readonly targetOnlineId: string | null;
}

export interface PlayStationAccountIdentity {
  readonly accountId: string;
  readonly onlineId: string;
}

export interface PlayStationTrophyCounts {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}

export interface PlayStationTrophySummary {
  readonly trophyLevel: number;
  readonly progress: number;
  readonly tier: number;
  readonly earnedTrophies: PlayStationTrophyCounts;
}

export interface PlayStationLibraryCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platform: PlayStationPlatform;
  readonly archived: boolean;
  readonly metadataProvider: string | null;
  readonly playStationLinkSource:
    | "sync_created"
    | "automatic_match"
    | "manual_match"
    | null;
}

export interface PlayStationTitleReconciliation {
  readonly status: PlayStationReconciliationStatus;
  readonly candidates: readonly PlayStationLibraryCandidate[];
}

export interface PlayStationCachedImageReference {
  readonly imageId: string;
  readonly url: string;
}

export interface ReconciledPlayStationTitle {
  readonly npServiceName: PlayStationServiceName;
  readonly npCommunicationId: string;
  readonly trophySetVersion: string;
  readonly name: string;
  readonly detail: string | null;
  readonly iconUrl: string;
  readonly cachedIcon: PlayStationCachedImageReference | null;
  readonly platforms: readonly PlayStationPlatform[];
  readonly hasTrophyGroups: boolean;
  readonly definedTrophies: PlayStationTrophyCounts;
  readonly progress: number;
  readonly earnedTrophies: PlayStationTrophyCounts;
  readonly hidden: boolean;
  readonly lastUpdatedAt: string;
  readonly reconciliation: PlayStationTitleReconciliation;
}

export interface PlayStationReconciliationCounts {
  readonly linked: number;
  readonly suggestedMatch: number;
  readonly ambiguous: number;
  readonly new: number;
}

export interface PlayStationTitlePreview {
  readonly target: PlayStationAccountIdentity;
  readonly targetTrophySummary: PlayStationTrophySummary;
  readonly providerTitleCount: number;
  readonly supportedTitleCount: number;
  readonly excludedTitleCount: number;
  readonly requestsMade: number;
  readonly titles: readonly ReconciledPlayStationTitle[];
  readonly reconciliationCounts: PlayStationReconciliationCounts;
}

export interface PlayStationGameLink {
  readonly gameId: string;
  readonly npCommunicationId: string;
  readonly npServiceName: PlayStationServiceName;
  readonly psnTitleName: string;
  readonly platforms: readonly PlayStationPlatform[];
  readonly iconUrl: string | null;
  readonly linkSource: "sync_created" | "automatic_match" | "manual_match";
  readonly linkedAt: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface CreatePlayStationTitleLinkInput {
  readonly gameId: string;
  readonly npCommunicationId: string;
  readonly npServiceName: PlayStationServiceName;
}

export interface CreatePlayStationTitleImportInput {
  readonly npCommunicationId: string;
  readonly npServiceName: PlayStationServiceName;
  readonly platform: PlayStationPlatform;
  readonly playStatus: PlayStatus;
}

export interface CreatedPlayStationLibraryGame {
  readonly game: LibraryGame;
  readonly link: PlayStationGameLink;
}

export interface PlayStationProfileSnapshot {
  readonly id: string;
  readonly syncRunId: string;
  readonly accountId: string;
  readonly capturedAt: string;
  readonly trophyLevel: number;
  readonly levelProgressPercent: number;
  readonly tier: number;
  readonly earnedTrophies: PlayStationTrophyCounts;
}

export type PlayStationSyncStatus = "succeeded" | "partial";

export type PlayStationSyncProgressStatus =
  | "idle"
  | "running"
  | "succeeded"
  | "failed";

export type PlayStationSyncProgressPhase =
  | "idle"
  | "fetching_titles"
  | "fetching_trophies"
  | "caching_artwork"
  | "saving_snapshots"
  | "complete"
  | "failed";

export interface PlayStationSyncProgress {
  readonly status: PlayStationSyncProgressStatus;
  readonly operation: "progress" | "full" | null;
  readonly phase: PlayStationSyncProgressPhase;
  readonly completedItems: number;
  readonly totalItems: number | null;
  readonly subtaskCompletedItems: number | null;
  readonly subtaskTotalItems: number | null;
  readonly currentItem: string | null;
  readonly message: string;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly finishedAt: string | null;
  readonly errorMessage: string | null;
}

export interface PlayStationSyncResult {
  readonly syncRunId: string;
  readonly status: PlayStationSyncStatus;
  readonly targetAccountId: string;
  readonly expectedTitleCount: number;
  readonly processedTitleCount: number;
  readonly snapshotsCreated: number;
  readonly newTrophyAlertsCreated: number;
  readonly completionLostAlertsCreated: number;
  readonly profileSnapshot: PlayStationProfileSnapshot;
  readonly requestsMade: number;
  readonly startedAt: string;
  readonly finishedAt: string;
}

export interface PlayStationTrophyDetailSynchronizationResult {
  readonly fullRefreshCount: number;
  readonly earningsOnlyRefreshCount: number;
  readonly unchangedCount: number;
  readonly requestsMade: number;
  readonly retriesUsed: number;
  readonly artworkReferenceCount: number;
  readonly uniqueArtworkImageCount: number;
  readonly artworkAttachedCount: number;
  readonly artworkFailedCount: number;
  readonly artworkDownloadedCount: number;
  readonly artworkNotModifiedCount: number;
}

export interface PlayStationProgressSyncSelection {
  readonly providerTitleCount: number;
  readonly supportedTitleCount: number;
  readonly excludedTitleCount: number;
  readonly linkedTitleCount: number;
}

export interface PlayStationProgressSynchronizationResponse {
  readonly synchronization: PlayStationSyncResult;
  readonly detailSynchronization: PlayStationTrophyDetailSynchronizationResult;
  readonly selection: PlayStationProgressSyncSelection;
}

export interface PlayStationSynchronizationResponse {
  readonly synchronization: PlayStationSyncResult;
  readonly detailSynchronization: PlayStationTrophyDetailSynchronizationResult;
  readonly preview: PlayStationTitlePreview;
}
