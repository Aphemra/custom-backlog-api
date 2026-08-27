import type { PlayStationPlatform } from "./libraryGame";

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

export interface PlayStationLibraryCandidate {
  readonly gameId: string;
  readonly title: string;
  readonly platform: PlayStationPlatform;
  readonly archived: boolean;
}

export interface PlayStationTitleReconciliation {
  readonly status: PlayStationReconciliationStatus;
  readonly candidates: readonly PlayStationLibraryCandidate[];
}

export interface ReconciledPlayStationTitle {
  readonly npServiceName: PlayStationServiceName;
  readonly npCommunicationId: string;
  readonly trophySetVersion: string;
  readonly name: string;
  readonly detail: string | null;
  readonly iconUrl: string;
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
