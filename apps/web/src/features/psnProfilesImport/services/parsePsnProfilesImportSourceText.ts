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

  const games = parsedData.games.map(normalizeImportedGame).filter((game): game is PsnProfilesImportedGameProgress => game !== null);

  return {
    importedAt: parsedData.exportedAt,
    sourceLabel: `PSNProfiles userscript export: ${parsedData.psnId}`,
    games,
    warnings: [...(parsedData.warnings ?? []), ...(games.length === 0 ? ["No games were found in the PSNProfiles userscript export."] : [])],
  };
}

function normalizeImportedGame(game: PsnProfilesImportedGameProgress): PsnProfilesImportedGameProgress | null {
  if (!game.sourceTitle.trim()) {
    return null;
  }

  if (!Number.isInteger(game.earnedTrophies) || !Number.isInteger(game.totalTrophies)) {
    return null;
  }

  if (game.totalTrophies <= 0 || game.earnedTrophies < 0 || game.earnedTrophies > game.totalTrophies) {
    return null;
  }

  return {
    sourceTitle: game.sourceTitle.trim(),
    platformIds: game.platformIds,
    earnedTrophies: game.earnedTrophies,
    totalTrophies: game.totalTrophies,
    completionPercent: clampNumber(game.completionPercent, 0, 100),
    ...(game.sourceTrophyListId !== undefined ? { sourceTrophyListId: game.sourceTrophyListId } : {}),
    ...(game.sourceUrl !== undefined ? { sourceUrl: game.sourceUrl } : {}),
    ...(game.platformText !== undefined ? { platformText: game.platformText } : {}),
    ...(game.rawPlatformText !== undefined ? { rawPlatformText: game.rawPlatformText } : {}),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
