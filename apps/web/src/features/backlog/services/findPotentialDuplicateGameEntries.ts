import type { GameEntry } from "../../../domain/backlog";
import { getPlatformShortName } from "../../../domain/display";
import type { GameExternalMetadata } from "../../../domain/externalMetadata";
import type { PlatformId } from "../../../domain/platform";

interface FindPotentialDuplicateGameEntriesInput {
  title: string;
  platformIds: PlatformId[];
  externalMetadata?: GameExternalMetadata;
}

export interface PotentialDuplicateGameEntry {
  gameEntry: GameEntry;
  reasons: string[];
}

export function findPotentialDuplicateGameEntries(
  gameEntries: GameEntry[],
  input: FindPotentialDuplicateGameEntriesInput,
): PotentialDuplicateGameEntry[] {
  const normalizedInputTitle = normalizeTitleForDuplicateCheck(input.title);
  const inputIgdbId = input.externalMetadata?.igdb?.igdbId;

  return gameEntries
    .map((gameEntry) => {
      const reasons: string[] = [];

      const hasSameIgdbId = inputIgdbId !== undefined && gameEntry.externalMetadata?.igdb?.igdbId === inputIgdbId;

      const hasSameTitle = normalizedInputTitle.length > 0 && normalizeTitleForDuplicateCheck(gameEntry.title) === normalizedInputTitle;

      const overlappingPlatformIds = input.platformIds.filter((platformId) => gameEntry.platformIds.includes(platformId));

      if (hasSameIgdbId) {
        reasons.push("Same mock IGDB ID");
      }

      if (hasSameTitle) {
        reasons.push("Same normalized title");
      }

      if ((hasSameIgdbId || hasSameTitle) && overlappingPlatformIds.length > 0) {
        reasons.push(`Shared platform(s): ${overlappingPlatformIds.map(getPlatformShortName).join(" / ")}`);
      }

      return {
        gameEntry,
        reasons,
      };
    })
    .filter((duplicate) => duplicate.reasons.length > 0);
}

function normalizeTitleForDuplicateCheck(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
