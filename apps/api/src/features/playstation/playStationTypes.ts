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
  providerTitleCount: number;
  supportedTitleCount: number;
  excludedTitleCount: number;
  titles: PlayStationTrophyTitlePreview[];
  requestsMade: number;
}
