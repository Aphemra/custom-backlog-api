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
