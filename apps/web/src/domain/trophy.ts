export type TrophyStatus = "not_started" | "started" | "cleanup" | "platinumed" | "hundred_percent" | "skipped" | "unobtainable" | "not_applicable";

export interface TrophyProgress {
  completionPercent?: number;
  earnedTrophies?: number;
  totalTrophies?: number;
  platinumEarned?: boolean;
  psnProfilesUrl?: string;
  lastSyncedAt?: string;
}
