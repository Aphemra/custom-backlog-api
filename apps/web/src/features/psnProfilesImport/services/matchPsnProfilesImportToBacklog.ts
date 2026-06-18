import type { GameEntry } from "../../../domain/backlog";
import type { PlatformId } from "../../../domain/platform";
import type { PsnProfilesBacklogMatch, PsnProfilesImportedGameProgress, PsnProfilesImportResult } from "../types/psnProfilesImport";

export function matchPsnProfilesImportToBacklog(importResult: PsnProfilesImportResult, gameEntries: GameEntry[]): PsnProfilesBacklogMatch[] {
  return importResult.games.map((importedGame) => {
    const bestMatch = findBestBacklogMatch(importedGame, gameEntries);

    if (!bestMatch) {
      return {
        importedGame,
        score: 0,
        reason: "No backlog match found",
      };
    }

    return {
      importedGame,
      gameEntryId: bestMatch.gameEntry.id,
      score: bestMatch.score,
      reason: bestMatch.reason,
    };
  });
}

function findBestBacklogMatch(
  importedGame: PsnProfilesImportedGameProgress,
  gameEntries: GameEntry[],
):
  | {
      gameEntry: GameEntry;
      score: number;
      reason: string;
    }
  | undefined {
  const candidates = gameEntries
    .map((gameEntry) => scoreBacklogMatch(importedGame, gameEntry))
    .filter((candidate) => candidate.score > 0)
    .sort((firstCandidate, secondCandidate) => secondCandidate.score - firstCandidate.score);

  return candidates[0];
}

function scoreBacklogMatch(
  importedGame: PsnProfilesImportedGameProgress,
  gameEntry: GameEntry,
): {
  gameEntry: GameEntry;
  score: number;
  reason: string;
} {
  if (importedGame.sourceUrl && gameEntry.trophyProgress.psnProfilesUrl === importedGame.sourceUrl) {
    return {
      gameEntry,
      score: 100,
      reason: "Exact PSNProfiles URL match",
    };
  }

  const platformMatch = hasPlatformOverlap(importedGame.platformIds, gameEntry.platformIds);

  const exactBacklogTitleMatch = normalizeTitle(gameEntry.title) === normalizeTitle(importedGame.sourceTitle);

  const exactIgdbTitleMatch =
    gameEntry.externalMetadata?.igdb !== undefined &&
    normalizeTitle(gameEntry.externalMetadata.igdb.name) === normalizeTitle(importedGame.sourceTitle);

  if (exactBacklogTitleMatch && platformMatch) {
    return {
      gameEntry,
      score: 100,
      reason: "Exact title and platform match",
    };
  }

  if (exactIgdbTitleMatch && platformMatch) {
    return {
      gameEntry,
      score: 98,
      reason: "Exact IGDB title and platform match",
    };
  }

  if (exactBacklogTitleMatch) {
    return {
      gameEntry,
      score: 90,
      reason: "Exact title match, but platform was uncertain",
    };
  }

  if (exactIgdbTitleMatch) {
    return {
      gameEntry,
      score: 88,
      reason: "Exact IGDB title match, but platform was uncertain",
    };
  }

  if (isSafePartialTitleMatch(gameEntry.title, importedGame.sourceTitle) && platformMatch) {
    return {
      gameEntry,
      score: 75,
      reason: "Possible title and platform match; review before applying",
    };
  }

  return {
    gameEntry,
    score: 0,
    reason: "No match",
  };
}

function hasPlatformOverlap(importedPlatformIds: PlatformId[], backlogPlatformIds: PlatformId[]): boolean {
  if (importedPlatformIds.length === 0 || backlogPlatformIds.length === 0) {
    return false;
  }

  const importedPlatformSet = new Set(importedPlatformIds);

  return backlogPlatformIds.some((platformId) => importedPlatformSet.has(platformId));
}

function isSafePartialTitleMatch(firstTitle: string, secondTitle: string): boolean {
  const firstTokens = getMeaningfulTitleTokens(firstTitle);
  const secondTokens = getMeaningfulTitleTokens(secondTitle);

  if (firstTokens.length === 0 || secondTokens.length === 0) {
    return false;
  }

  const sharedTokens = firstTokens.filter((token) => secondTokens.includes(token));

  if (sharedTokens.length < 2) {
    return false;
  }

  const firstNormalized = normalizeTitle(firstTitle);
  const secondNormalized = normalizeTitle(secondTitle);

  if (isKnownFranchiseCollision(firstNormalized, secondNormalized)) {
    return false;
  }

  return firstNormalized.includes(secondNormalized) || secondNormalized.includes(firstNormalized);
}

function isKnownFranchiseCollision(firstTitle: string, secondTitle: string): boolean {
  const franchisePrefixes = ["final fantasy", "kingdom hearts", "resident evil", "persona", "yakuza", "like a dragon"];

  return franchisePrefixes.some((prefix) => {
    const firstStartsWithPrefix = firstTitle.startsWith(prefix);
    const secondStartsWithPrefix = secondTitle.startsWith(prefix);

    if (!firstStartsWithPrefix || !secondStartsWithPrefix) {
      return false;
    }

    return firstTitle !== secondTitle;
  });
}

function getMeaningfulTitleTokens(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length >= 3)
    .filter((token) => !["the", "and", "remake", "remastered", "edition"].includes(token));
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
