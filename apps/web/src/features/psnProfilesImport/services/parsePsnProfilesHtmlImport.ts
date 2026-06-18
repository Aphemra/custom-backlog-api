import type { PlatformId } from "../../../domain/platform";
import type { PsnProfilesImportedGameProgress, PsnProfilesImportResult } from "../types/psnProfilesImport";

export function parsePsnProfilesHtmlImport(sourceText: string): PsnProfilesImportResult {
  const trimmedSourceText = sourceText.trim();

  if (!trimmedSourceText) {
    throw new Error("Paste or upload PSNProfiles HTML/text before importing.");
  }

  const document = new DOMParser().parseFromString(trimmedSourceText, "text/html");
  const importedAt = new Date().toISOString();

  const games = parseGamesFromDocument(document);

  return {
    importedAt,
    sourceLabel: getSourceLabel(document),
    games,
    warnings: getImportWarnings(games),
  };
}

function parseGamesFromDocument(document: Document): PsnProfilesImportedGameProgress[] {
  const profileGameRows = Array.from(document.querySelectorAll<HTMLTableRowElement>("#gamesTable > tbody > tr"));

  if (profileGameRows.length > 0) {
    return parseProfileGameRows(profileGameRows);
  }

  return parseFallbackTrophyLinks(document);
}

function parseProfileGameRows(rows: HTMLTableRowElement[]): PsnProfilesImportedGameProgress[] {
  const importedGames: PsnProfilesImportedGameProgress[] = [];

  for (const row of rows) {
    const importedGame = parseProfileGameRow(row);

    if (!importedGame) {
      continue;
    }

    if (!isDuplicateImportedGame(importedGames, importedGame)) {
      importedGames.push(importedGame);
    }
  }

  return importedGames;
}

function parseProfileGameRow(row: HTMLTableRowElement): PsnProfilesImportedGameProgress | null {
  const titleLink = row.querySelector<HTMLAnchorElement>('a.title[href*="/trophies/"]');

  if (!titleLink) {
    return null;
  }

  const sourceTitle = cleanTitle(titleLink.textContent ?? "");

  if (!sourceTitle) {
    return null;
  }

  const sourceUrl = normalizePsnProfilesUrl(titleLink.getAttribute("href") ?? titleLink.href);
  const sourceTrophyListId = parseTrophyListIdFromUrl(sourceUrl);

  const trophySummaryText = normalizeWhitespace(row.querySelector(".small-info")?.textContent ?? row.textContent ?? "");
  const trophyCount = parseTrophyCount(trophySummaryText);

  if (!trophyCount) {
    return null;
  }

  const completionPercent = parseCompletionPercent(row, trophyCount);
  const platformData = parsePlatformData(row);

  return {
    sourceTitle,
    platformIds: platformData.platformIds,
    earnedTrophies: trophyCount.earnedTrophies,
    totalTrophies: trophyCount.totalTrophies,
    completionPercent,
    ...(sourceTrophyListId !== undefined ? { sourceTrophyListId } : {}),
    ...(sourceUrl !== undefined ? { sourceUrl } : {}),
    ...(platformData.platformText !== undefined ? { platformText: platformData.platformText } : {}),
    ...(platformData.rawPlatformText !== undefined ? { rawPlatformText: platformData.rawPlatformText } : {}),
  };
}

function parseFallbackTrophyLinks(document: Document): PsnProfilesImportedGameProgress[] {
  const trophyLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/trophies/"]'));
  const importedGames: PsnProfilesImportedGameProgress[] = [];

  for (const trophyLink of trophyLinks) {
    const sourceTitle = cleanTitle(trophyLink.textContent ?? "");

    if (!sourceTitle) {
      continue;
    }

    const container = findLikelyGameContainer(trophyLink);
    const containerText = normalizeWhitespace(container?.textContent ?? trophyLink.parentElement?.textContent ?? "");

    const trophyCount = parseTrophyCount(containerText);

    if (!trophyCount) {
      continue;
    }

    const sourceUrl = normalizePsnProfilesUrl(trophyLink.getAttribute("href") ?? trophyLink.href);
    const sourceTrophyListId = parseTrophyListIdFromUrl(sourceUrl);
    const completionPercent = parseCompletionPercentFromText(containerText, trophyCount);
    const platformData = container ? parsePlatformData(container) : parsePlatformData(trophyLink);

    const importedGame: PsnProfilesImportedGameProgress = {
      sourceTitle,
      platformIds: platformData.platformIds,
      earnedTrophies: trophyCount.earnedTrophies,
      totalTrophies: trophyCount.totalTrophies,
      completionPercent,
      ...(sourceTrophyListId !== undefined ? { sourceTrophyListId } : {}),
      ...(sourceUrl !== undefined ? { sourceUrl } : {}),
      ...(platformData.platformText !== undefined ? { platformText: platformData.platformText } : {}),
      ...(platformData.rawPlatformText !== undefined ? { rawPlatformText: platformData.rawPlatformText } : {}),
    };

    if (!isDuplicateImportedGame(importedGames, importedGame)) {
      importedGames.push(importedGame);
    }
  }

  return importedGames;
}

function findLikelyGameContainer(element: Element): Element | null {
  return (
    element.closest("tr") ??
    element.closest("li") ??
    element.closest("article") ??
    element.closest(".game") ??
    element.closest(".title") ??
    element.parentElement
  );
}

function parseTrophyCount(text: string): { earnedTrophies: number; totalTrophies: number } | null {
  const normalizedText = normalizeWhitespace(text);

  const completeMatch = normalizedText.match(/\bAll\s+(\d{1,4})\s+Trophies\b/i);

  if (completeMatch) {
    const totalTrophies = Number(completeMatch[1]);

    if (Number.isInteger(totalTrophies) && totalTrophies > 0) {
      return {
        earnedTrophies: totalTrophies,
        totalTrophies,
      };
    }
  }

  const trophyCountPatterns = [/(\d{1,4})\s*\/\s*(\d{1,4})/, /(\d{1,4})\s+of\s+(\d{1,4})\s+Trophies/i, /(\d{1,4})\s+of\s+(\d{1,4})/i];

  for (const pattern of trophyCountPatterns) {
    const match = normalizedText.match(pattern);

    if (!match) {
      continue;
    }

    const earnedTrophies = Number(match[1]);
    const totalTrophies = Number(match[2]);

    if (!Number.isInteger(earnedTrophies) || !Number.isInteger(totalTrophies)) {
      continue;
    }

    if (earnedTrophies < 0 || totalTrophies <= 0 || earnedTrophies > totalTrophies) {
      continue;
    }

    return {
      earnedTrophies,
      totalTrophies,
    };
  }

  return null;
}

function parseCompletionPercent(
  row: Element,
  trophyCount: {
    earnedTrophies: number;
    totalTrophies: number;
  },
): number {
  const progressText = normalizeWhitespace(row.querySelector(".trophy-count .progress-bar span")?.textContent ?? "");

  return parseCompletionPercentFromText(progressText || row.textContent || "", trophyCount);
}

function parseCompletionPercentFromText(
  text: string,
  trophyCount: {
    earnedTrophies: number;
    totalTrophies: number;
  },
): number {
  const percentMatch = text.match(/(\d{1,3})\s*%/);

  if (percentMatch) {
    const parsedPercent = Number(percentMatch[1]);

    if (Number.isInteger(parsedPercent)) {
      return clampNumber(parsedPercent, 0, 100);
    }
  }

  return Math.round((trophyCount.earnedTrophies / trophyCount.totalTrophies) * 100);
}

function parsePlatformData(element: Element): {
  platformIds: PlatformId[];
  platformText?: string;
  rawPlatformText?: string;
} {
  const platformTags = Array.from(element.querySelectorAll<HTMLElement>(".platforms .tag.platform, .tag.platform"));

  const rawPlatformNames = platformTags
    .map((platformTag) => normalizeWhitespace(platformTag.textContent ?? ""))
    .filter((platformName) => platformName.length > 0);

  const platformIds = platformTags.map(mapPlatformTagToPlatformId).filter((platformId): platformId is PlatformId => platformId !== undefined);

  const uniquePlatformIds = Array.from(new Set(platformIds));
  const platformText = uniquePlatformIds.map(formatPlatformId).join(" / ");
  const rawPlatformText = Array.from(new Set(rawPlatformNames)).join(" / ");

  return {
    platformIds: uniquePlatformIds,
    ...(platformText ? { platformText } : {}),
    ...(rawPlatformText ? { rawPlatformText } : {}),
  };
}

function mapPlatformTagToPlatformId(platformTag: HTMLElement): PlatformId | undefined {
  const classNames = Array.from(platformTag.classList).map((className) => className.toLowerCase());
  const text = normalizeWhitespace(platformTag.textContent ?? "").toLowerCase();

  if (classNames.includes("ps5") || text === "ps5") {
    return "ps5";
  }

  if (classNames.includes("ps4") || text === "ps4") {
    return "ps4";
  }

  if (classNames.includes("ps3") || text === "ps3") {
    return "ps3";
  }

  return undefined;
}

function formatPlatformId(platformId: PlatformId): string {
  switch (platformId) {
    case "ps1":
      return "PS1";

    case "ps2":
      return "PS2";

    case "ps3":
      return "PS3";

    case "ps4":
      return "PS4";

    case "ps5":
      return "PS5";

    case "psp":
      return "PSP";

    case "ps-vita":
      return "Vita";

    case "psvr":
      return "PSVR";

    case "psvr2":
      return "PSVR2";
  }
}

function normalizePsnProfilesUrl(value: string): string | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    return new URL(trimmedValue, "https://psnprofiles.com").toString();
  } catch {
    return undefined;
  }
}

function parseTrophyListIdFromUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\/trophies\/([^/?#]+)/i);

  return match?.[1];
}

function getSourceLabel(document: Document): string {
  const title = normalizeWhitespace(document.title);

  return title || "PSNProfiles import";
}

function getImportWarnings(games: PsnProfilesImportedGameProgress[]): string[] {
  const warnings: string[] = [];

  if (games.length === 0) {
    warnings.push("No trophy progress rows were detected. The parser may need to be adjusted for this PSNProfiles page.");
  }

  return warnings;
}

function cleanTitle(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s+trophies$/i, "")
    .replace(/\s+trophy list$/i, "")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function isDuplicateImportedGame(importedGames: PsnProfilesImportedGameProgress[], nextGame: PsnProfilesImportedGameProgress): boolean {
  return importedGames.some((existingGame) => {
    if (existingGame.sourceTrophyListId && nextGame.sourceTrophyListId) {
      return existingGame.sourceTrophyListId === nextGame.sourceTrophyListId;
    }

    if (existingGame.sourceUrl && nextGame.sourceUrl) {
      return existingGame.sourceUrl === nextGame.sourceUrl;
    }

    return (
      normalizeTitle(existingGame.sourceTitle) === normalizeTitle(nextGame.sourceTitle) &&
      existingGame.totalTrophies === nextGame.totalTrophies &&
      getPlatformMatchKey(existingGame.platformIds) === getPlatformMatchKey(nextGame.platformIds)
    );
  });
}

function getPlatformMatchKey(platformIds: PlatformId[]): string {
  return [...platformIds].sort().join("|");
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
