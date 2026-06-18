import type { GameEntry } from "../../../domain/backlog";
import type { ManualTrophySyncInput, TrophySyncPreview, TrophySyncPreviewChange } from "../types/trophySyncPreview";

export function createManualTrophySyncPreview(game: GameEntry, input: ManualTrophySyncInput): TrophySyncPreview {
  const normalizedInput: ManualTrophySyncInput = {
    psnProfilesUrl: input.psnProfilesUrl.trim(),
    earnedTrophies: input.earnedTrophies,
    totalTrophies: input.totalTrophies,
  };

  const changes: TrophySyncPreviewChange[] = [];
  const warnings = getTrophySyncWarnings(normalizedInput);

  const currentPsnProfilesUrl = game.trophyProgress.psnProfilesUrl?.trim() ?? "";
  const currentEarnedTrophies = game.trophyProgress.earnedTrophies ?? 0;
  const currentTotalTrophies = game.trophyProgress.totalTrophies ?? 0;

  if (currentPsnProfilesUrl !== normalizedInput.psnProfilesUrl) {
    changes.push({
      field: "psnProfilesUrl",
      label: "PSNProfiles URL",
      currentValue: currentPsnProfilesUrl || "None",
      nextValue: normalizedInput.psnProfilesUrl || "None",
    });
  }

  if (currentEarnedTrophies !== normalizedInput.earnedTrophies) {
    changes.push({
      field: "earnedTrophies",
      label: "Earned trophies",
      currentValue: currentEarnedTrophies.toString(),
      nextValue: normalizedInput.earnedTrophies.toString(),
    });
  }

  if (currentTotalTrophies !== normalizedInput.totalTrophies) {
    changes.push({
      field: "totalTrophies",
      label: "Total trophies",
      currentValue: currentTotalTrophies.toString(),
      nextValue: normalizedInput.totalTrophies.toString(),
    });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    warnings,
    nextData: normalizedInput,
  };
}

function getTrophySyncWarnings(input: ManualTrophySyncInput): string[] {
  const warnings: string[] = [];

  if (!input.psnProfilesUrl) {
    warnings.push("A PSNProfiles trophy page URL is recommended before applying.");
  } else if (!isLikelyPsnProfilesTrophyUrl(input.psnProfilesUrl)) {
    warnings.push("This does not look like a PSNProfiles trophy page URL. Double-check it before applying.");
  }

  if (input.totalTrophies <= 0) {
    warnings.push("Total trophies must be greater than zero.");
  }

  if (input.earnedTrophies > input.totalTrophies) {
    warnings.push("Earned trophies cannot be greater than total trophies.");
  }

  return warnings;
}

function isLikelyPsnProfilesTrophyUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.hostname === "psnprofiles.com" && url.pathname.toLowerCase().includes("/trophies/");
  } catch {
    return false;
  }
}
