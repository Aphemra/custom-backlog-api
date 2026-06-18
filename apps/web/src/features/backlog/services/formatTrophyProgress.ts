import type { TrophyProgress } from "../../../domain/trophy";
import { normalizeTrophyProgress } from "./trophyProgressHelpers";

export function formatCompletionPercent(trophyProgress: TrophyProgress): string {
  const normalizedProgress = normalizeTrophyProgress(trophyProgress);

  return `${normalizedProgress.completionPercent}%`;
}

export function formatTrophyCount(trophyProgress: TrophyProgress): string {
  const normalizedProgress = normalizeTrophyProgress(trophyProgress);

  return `${normalizedProgress.earnedTrophies}/${normalizedProgress.totalTrophies}`;
}

export function getSafeCompletionPercent(trophyProgress: TrophyProgress): number {
  return normalizeTrophyProgress(trophyProgress).completionPercent;
}
