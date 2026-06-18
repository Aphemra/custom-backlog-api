import type { PlatformId } from "../../../domain/platform";
import type { PsnProfilesImportedGameProgress, PsnProfilesImportResult, PsnProfilesUserscriptExportPayload } from "../types/psnProfilesImport";
import { parsePsnProfilesHtmlImport } from "./parsePsnProfilesHtmlImport";

export function parsePsnProfilesImportSourceText(sourceText: string): PsnProfilesImportResult {
  const trimmedSourceText = sourceText.trim();

  if (!trimmedSourceText) {
    throw new Error("Paste or upload PSNProfiles HTML/text/JSON before importing.");
  }

  if (trimmedSourceText.startsWith("{")) {
    return parsePsnProfilesUserscriptJson(trimmedSourceText);
  }

  return parsePsnProfilesHtmlImport(sourceText);
}

function parsePsnProfilesUserscriptJson(sourceText: string): PsnProfilesImportResult {
  let parsedData: unknown;

  try {
    parsedData = JSON.parse(sourceText);
  } catch {
    throw new Error("The pasted PSNProfiles JSON export is not valid JSON.");
  }

  if (!isPsnProfilesUserscriptExportPayload(parsedData)) {
    throw new Error("This JSON does not look like a Custom Backlog PSNProfiles userscript export.");
  }

  const games = parsedData.games.map((game) => normalizeImportedGame(game)).filter((game): game is PsnProfilesImportedGameProgress => game !== null);

  return {
    importedAt: parsedData.exportedAt,
    sourceLabel: `PSNProfiles userscript export: ${parsedData.psnId}`,
    games,
    warnings: [...(parsedData.warnings ?? []), ...(games.length === 0 ? ["No games were found in the PSNProfiles userscript export."] : [])],
  };
}

function normalizeImportedGame(data: unknown): PsnProfilesImportedGameProgress | null {
  if (!isRecord(data)) {
    return null;
  }

  if (typeof data.sourceTitle !== "string" || !data.sourceTitle.trim()) {
    return null;
  }

  if (!Array.isArray(data.platformIds)) {
    return null;
  }

  if (typeof data.earnedTrophies !== "number" || typeof data.totalTrophies !== "number" || typeof data.completionPercent !== "number") {
    return null;
  }

  if (data.totalTrophies <= 0 || data.earnedTrophies < 0 || data.earnedTrophies > data.totalTrophies) {
    return null;
  }

  const platformIds = data.platformIds.filter(isPlatformId);

  return {
    sourceTitle: data.sourceTitle.trim(),
    platformIds,
    earnedTrophies: data.earnedTrophies,
    totalTrophies: data.totalTrophies,
    completionPercent: clampNumber(data.completionPercent, 0, 100),
    ...(typeof data.sourceTrophyListId === "string" ? { sourceTrophyListId: data.sourceTrophyListId } : {}),
    ...(typeof data.sourceUrl === "string" ? { sourceUrl: data.sourceUrl } : {}),
    ...(typeof data.platformText === "string" ? { platformText: data.platformText } : {}),
    ...(typeof data.rawPlatformText === "string" ? { rawPlatformText: data.rawPlatformText } : {}),
  };
}

function isPsnProfilesUserscriptExportPayload(value: unknown): value is PsnProfilesUserscriptExportPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.source === "psnprofiles-userscript" &&
    value.version === 1 &&
    typeof value.psnId === "string" &&
    typeof value.profileUrl === "string" &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.games)
  );
}

function isPlatformId(value: unknown): value is PlatformId {
  return (
    value === "ps1" ||
    value === "ps2" ||
    value === "ps3" ||
    value === "ps4" ||
    value === "ps5" ||
    value === "psp" ||
    value === "ps-vita" ||
    value === "psvr" ||
    value === "psvr2"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
