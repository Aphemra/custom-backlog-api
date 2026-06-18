import type { PlatformId } from "../../../domain/platform";

export interface PsnProfilesImportedGameProgress {
  sourceTitle: string;
  sourceTrophyListId?: string;
  sourceUrl?: string;
  platformIds: PlatformId[];
  platformText?: string;
  rawPlatformText?: string;
  earnedTrophies: number;
  totalTrophies: number;
  completionPercent: number;
}

export interface PsnProfilesImportResult {
  importedAt: string;
  sourceLabel: string;
  games: PsnProfilesImportedGameProgress[];
  warnings: string[];
}

export interface PsnProfilesBacklogMatch {
  importedGame: PsnProfilesImportedGameProgress;
  gameEntryId?: string;
  score: number;
  reason: string;
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
