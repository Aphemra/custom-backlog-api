export interface PsnProfilesImportedGameProgress {
  sourceTitle: string;
  sourceTrophyListId?: string;
  sourceUrl?: string;
  platformIds: string[];
  platformText?: string;
  rawPlatformText?: string;
  earnedTrophies: number;
  totalTrophies: number;
  completionPercent: number;
}

export interface PsnProfilesUserscriptExportPayload {
  source: "psnprofiles-userscript";
  version: 1;
  psnId: string;
  profileUrl: string;
  exportedAt: string;
  games: PsnProfilesImportedGameProgress[];
  warnings?: string[];
}

export interface StoredPsnProfilesImport {
  savedAt: string;
  payload: PsnProfilesUserscriptExportPayload;
}
