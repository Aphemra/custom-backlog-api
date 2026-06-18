export interface PublicTrophyCounts {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
  total: number;
}

export interface PlatPricesTrophyMetadataResult {
  provider: "platprices";
  providerGameId: string;
  name: string;
  platformNames: string[];
  trophyCounts: PublicTrophyCounts;
  sourceUrl?: string;
}
