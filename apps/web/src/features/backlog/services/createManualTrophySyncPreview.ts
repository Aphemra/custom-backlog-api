import type { GameEntry } from "../../../domain/backlog";
import type { ManualTrophySyncInput, TrophySyncPreview, TrophySyncPreviewAlert, TrophySyncPreviewChange } from "../types/trophySyncPreview";
import { calculateTrophyCompletionPercent, isTrophyProgressNumericallyComplete, normalizeTrophyProgress } from "./trophyProgressHelpers";

export function createManualTrophySyncPreview(game: GameEntry, input: ManualTrophySyncInput): TrophySyncPreview {
  const normalizedInput: ManualTrophySyncInput = {
    psnProfilesUrl: input.psnProfilesUrl.trim(),
    earnedTrophies: input.earnedTrophies,
    totalTrophies: input.totalTrophies,
  };

  const changes: TrophySyncPreviewChange[] = [];
  const warnings = getTrophySyncWarnings(normalizedInput);

  const currentTrophyProgress = normalizeTrophyProgress(game.trophyProgress);

  const currentPsnProfilesUrl = currentTrophyProgress.psnProfilesUrl?.trim() ?? "";
  const currentEarnedTrophies = currentTrophyProgress.earnedTrophies;
  const currentTotalTrophies = currentTrophyProgress.totalTrophies;
  const currentCompletionPercent = currentTrophyProgress.completionPercent;

  const nextCompletionPercent = calculateTrophyCompletionPercent({
    earnedTrophies: normalizedInput.earnedTrophies,
    totalTrophies: normalizedInput.totalTrophies,
  });

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

  if (currentCompletionPercent !== nextCompletionPercent) {
    changes.push({
      field: "completionPercent",
      label: "Completion percent",
      currentValue: `${currentCompletionPercent}%`,
      nextValue: `${nextCompletionPercent}%`,
    });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    warnings,
    alerts: getTrophySyncAlerts({
      game,
      currentTotalTrophies,
      nextEarnedTrophies: normalizedInput.earnedTrophies,
      nextTotalTrophies: normalizedInput.totalTrophies,
      nextCompletionPercent,
    }),
    nextData: normalizedInput,
    nextCompletionPercent,
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

function getTrophySyncAlerts({
  game,
  currentTotalTrophies,
  nextEarnedTrophies,
  nextTotalTrophies,
  nextCompletionPercent,
}: {
  game: GameEntry;
  currentTotalTrophies: number;
  nextEarnedTrophies: number;
  nextTotalTrophies: number;
  nextCompletionPercent: number;
}): TrophySyncPreviewAlert[] {
  const alerts: TrophySyncPreviewAlert[] = [];

  const wasMarkedComplete = game.trophyStatus === "hundred_percent" || game.trophyStatus === "platinumed";

  const wasNumericallyComplete = isTrophyProgressNumericallyComplete(game.trophyProgress);

  const willBeIncomplete = nextTotalTrophies > 0 && nextEarnedTrophies < nextTotalTrophies && nextCompletionPercent < 100;

  const totalTrophiesIncreased = nextTotalTrophies > currentTotalTrophies;

  if ((wasMarkedComplete || wasNumericallyComplete) && willBeIncomplete) {
    alerts.push({
      severity: "warning",
      title: "Completion regression detected",
      message:
        "This game appears to have been complete before, but the proposed sync would make it incomplete. This may mean new DLC trophies were added.",
    });
  }

  if (totalTrophiesIncreased) {
    alerts.push({
      severity: "warning",
      title: "Total trophy count increased",
      message: `Total trophies would increase from ${currentTotalTrophies} to ${nextTotalTrophies}. Review this carefully if you were trying to maintain 100%.`,
    });
  }

  if (nextCompletionPercent === 100 && game.trophyStatus !== "hundred_percent") {
    alerts.push({
      severity: "info",
      title: "Now appears 100% complete",
      message: "The proposed trophy counts equal 100%. You may want to update this game’s trophy status to 100% after applying.",
    });
  }

  return alerts;
}

function isLikelyPsnProfilesTrophyUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.hostname === "psnprofiles.com" && url.pathname.toLowerCase().includes("/trophies/");
  } catch {
    return false;
  }
}
