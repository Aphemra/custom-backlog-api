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
