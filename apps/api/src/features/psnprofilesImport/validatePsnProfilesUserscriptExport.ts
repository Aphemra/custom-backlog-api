import type { PsnProfilesImportedGameProgress, PsnProfilesUserscriptExportPayload } from "./psnProfilesImportTypes.js";

export function validatePsnProfilesUserscriptExport(data: unknown): PsnProfilesUserscriptExportPayload {
  if (!isRecord(data)) {
    throw new Error("PSNProfiles export must be a JSON object.");
  }

  if (data.source !== "psnprofiles-userscript") {
    throw new Error("PSNProfiles export has an invalid source.");
  }

  if (data.version !== 1) {
    throw new Error("PSNProfiles export has an unsupported version.");
  }

  if (typeof data.psnId !== "string" || !data.psnId.trim()) {
    throw new Error("PSNProfiles export is missing psnId.");
  }

  if (typeof data.profileUrl !== "string" || !data.profileUrl.trim()) {
    throw new Error("PSNProfiles export is missing profileUrl.");
  }

  if (typeof data.exportedAt !== "string" || !data.exportedAt.trim()) {
    throw new Error("PSNProfiles export is missing exportedAt.");
  }

  if (!Array.isArray(data.games)) {
    throw new Error("PSNProfiles export is missing games.");
  }

  const games = data.games.map(validateImportedGame);

  return {
    source: "psnprofiles-userscript",
    version: 1,
    psnId: data.psnId.trim(),
    profileUrl: data.profileUrl.trim(),
    exportedAt: data.exportedAt,
    games,
    ...(Array.isArray(data.warnings) ? { warnings: data.warnings.filter((warning): warning is string => typeof warning === "string") } : {}),
  };
}

function validateImportedGame(data: unknown): PsnProfilesImportedGameProgress {
  if (!isRecord(data)) {
    throw new Error("A PSNProfiles game entry was not a JSON object.");
  }

  if (typeof data.sourceTitle !== "string" || !data.sourceTitle.trim()) {
    throw new Error("A PSNProfiles game entry is missing sourceTitle.");
  }

  if (!Array.isArray(data.platformIds)) {
    throw new Error(`PSNProfiles game "${data.sourceTitle}" is missing platformIds.`);
  }

  if (typeof data.earnedTrophies !== "number" || typeof data.totalTrophies !== "number") {
    throw new Error(`PSNProfiles game "${data.sourceTitle}" is missing trophy counts.`);
  }

  if (typeof data.completionPercent !== "number") {
    throw new Error(`PSNProfiles game "${data.sourceTitle}" is missing completionPercent.`);
  }

  return {
    sourceTitle: data.sourceTitle.trim(),
    platformIds: data.platformIds.filter((platformId): platformId is string => typeof platformId === "string"),
    earnedTrophies: data.earnedTrophies,
    totalTrophies: data.totalTrophies,
    completionPercent: data.completionPercent,
    ...(typeof data.sourceTrophyListId === "string" ? { sourceTrophyListId: data.sourceTrophyListId } : {}),
    ...(typeof data.sourceUrl === "string" ? { sourceUrl: data.sourceUrl } : {}),
    ...(typeof data.platformText === "string" ? { platformText: data.platformText } : {}),
    ...(typeof data.rawPlatformText === "string" ? { rawPlatformText: data.rawPlatformText } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
