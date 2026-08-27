export interface PlayStationCredentials {
  readerNpsso: string | null;
  readerOnlineId: string | null;
  targetOnlineId: string | null;
}

export interface PlayStationRequestPolicy {
  minimumIntervalMs: number;
}

export interface PlayStationRetryPolicy {
  maximumRetriesPerSync: number;
  maximumAttemptsPerRequest: number;
}

export interface PlayStationConnectionStatus {
  configured: boolean;
  readerOnlineId: string | null;
  targetOnlineId: string | null;
}

export interface PlayStationAccountIdentity {
  accountId: string;
  onlineId: string;
}

export interface PlayStationTrophySummary {
  trophyLevel: number;
  progress: number;
  tier: number;
  earnedTrophies: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

export interface PlayStationConnectionResult {
  reader: PlayStationAccountIdentity;
  target: PlayStationAccountIdentity;
  targetTrophySummary: PlayStationTrophySummary;
  requestsMade: number;
}

export type PlayStationTrophyPlatform = "PS3" | "PS4" | "PS5";

export interface PlayStationTrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

export type PlayStationTrophyType = "bronze" | "silver" | "gold" | "platinum";

export type PlayStationTrophyRarity = 0 | 1 | 2 | 3;

export interface PlayStationTrophyGroupDefinition {
  trophyGroupId: string;
  name: string;
  detail: string | null;
  iconUrl: string;
  definedTrophies: PlayStationTrophyCounts;
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophySetDefinition {
  trophySetVersion: string;
  titleName: string;
  titleDetail: string | null;
  titleIconUrl: string;
  platforms: PlayStationTrophyPlatform[];
  hasTrophyGroups: boolean;
  definedTrophies: PlayStationTrophyCounts;
  groups: PlayStationTrophyGroupDefinition[];
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophyDefinition {
  trophyId: number;
  trophyGroupId: string;
  trophyType: PlayStationTrophyType;
  hidden: boolean;
  name: string | null;
  detail: string | null;
  iconUrl: string | null;
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophyDefinitionPage {
  trophySetVersion: string;
  hasTrophyGroups: boolean;
  trophies: PlayStationTrophyDefinition[];
  totalItemCount: number;
  nextOffset: number | null;
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophyEarning {
  trophyId: number;
  trophyType: PlayStationTrophyType;
  hidden: boolean;
  earned: boolean;
  earnedAt: string | null;
  rarity: PlayStationTrophyRarity | null;
  earnedRate: number | null;
  progressTargetValue: string | null;
  progressValue: string | null;
  progressRate: number | null;
  rewardName: string | null;
  rewardImageUrl: string | null;
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophyEarningsPage {
  trophySetVersion: string;
  hasTrophyGroups: boolean;
  lastUpdatedAt: string;
  trophies: PlayStationTrophyEarning[];
  totalItemCount: number;
  nextOffset: number | null;
  providerPayload: Readonly<Record<string, unknown>>;
}

export interface PlayStationTrophyDetailFetchResult {
  trophySet: PlayStationTrophySetDefinition;
  definitions: PlayStationTrophyDefinition[];
  earnings: PlayStationTrophyEarning[];
  lastUpdatedAt: string;
  requestsMade: number;
  retriesUsed: number;
}

export interface PlayStationTrophyEarningsFetchResult {
  earnings: PlayStationTrophyEarning[];
  lastUpdatedAt: string;
  requestsMade: number;
  retriesUsed: number;
}

export interface PlayStationTrophyTitlePreview {
  npServiceName: "trophy" | "trophy2";
  npCommunicationId: string;
  trophySetVersion: string;
  name: string;
  detail: string | null;
  iconUrl: string;
  platforms: PlayStationTrophyPlatform[];
  hasTrophyGroups: boolean;
  definedTrophies: PlayStationTrophyCounts;
  progress: number;
  earnedTrophies: PlayStationTrophyCounts;
  hidden: boolean;
  lastUpdatedAt: string;
}

export interface PlayStationTitlePreviewResult {
  target: PlayStationAccountIdentity;
  targetTrophySummary: PlayStationTrophySummary;
  providerTitleCount: number;
  supportedTitleCount: number;
  excludedTitleCount: number;
  titles: PlayStationTrophyTitlePreview[];
  requestsMade: number;
}

export type PlayStationReconciliationStatus =
  | "linked"
  | "suggested_match"
  | "ambiguous"
  | "new";

export interface PlayStationLibraryCandidate {
  gameId: string;
  title: string;
  platform: PlayStationTrophyPlatform;
  archived: boolean;
  metadataProvider: string | null;
  playStationLinkSource:
    | "sync_created"
    | "automatic_match"
    | "manual_match"
    | null;
}

export interface PlayStationTitleReconciliation {
  status: PlayStationReconciliationStatus;
  candidates: PlayStationLibraryCandidate[];
}

export interface PlayStationCachedImageReference {
  imageId: string;
  url: string;
}

export interface ReconciledPlayStationTitle extends PlayStationTrophyTitlePreview {
  cachedIcon: PlayStationCachedImageReference | null;
  reconciliation: PlayStationTitleReconciliation;
}

export interface PlayStationReconciliationCounts {
  linked: number;
  suggestedMatch: number;
  ambiguous: number;
  new: number;
}

export interface ReconciledPlayStationTitlePreviewResult extends Omit<
  PlayStationTitlePreviewResult,
  "titles"
> {
  titles: ReconciledPlayStationTitle[];
  reconciliationCounts: PlayStationReconciliationCounts;
}

export interface PlayStationTrophySyncPreview {
  target: PlayStationAccountIdentity;
  targetTrophySummary: PlayStationTrophySummary;
  titles: ReconciledPlayStationTitle[];
  requestsMade: number;
}

export interface LinkedPlayStationTitlePreviewResult extends PlayStationTrophySyncPreview {
  providerTitleCount: number;
  supportedTitleCount: number;
  excludedTitleCount: number;
  linkedTitleCount: number;
}

export interface PlayStationProfileSnapshot {
  id: string;
  syncRunId: string;
  accountId: string;
  capturedAt: string;
  trophyLevel: number;
  levelProgressPercent: number;
  tier: number;
  earnedTrophies: PlayStationTrophyCounts;
}

export type PlayStationSyncStatus = "succeeded" | "partial";

export interface PlayStationSyncResult {
  syncRunId: string;
  status: PlayStationSyncStatus;
  targetAccountId: string;
  expectedTitleCount: number;
  processedTitleCount: number;
  snapshotsCreated: number;
  newTrophyAlertsCreated: number;
  completionLostAlertsCreated: number;
  profileSnapshot: PlayStationProfileSnapshot;
  requestsMade: number;
  startedAt: string;
  finishedAt: string;
}
