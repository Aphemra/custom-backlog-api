import type { TrophyProgress } from "../../../domain/trophy";

export function formatCompletionPercent(trophyProgress: TrophyProgress): string {
  if (trophyProgress.completionPercent === undefined) {
    return "Unknown";
  }

  return `${trophyProgress.completionPercent}%`;
}

export function formatTrophyCount(trophyProgress: TrophyProgress): string {
  if (trophyProgress.earnedTrophies === undefined || trophyProgress.totalTrophies === undefined) {
    return "Unknown";
  }

  return `${trophyProgress.earnedTrophies}/${trophyProgress.totalTrophies}`;
}

export function getSafeCompletionPercent(trophyProgress: TrophyProgress): number {
  const completionPercent = trophyProgress.completionPercent ?? 0;

  if (completionPercent < 0) {
    return 0;
  }

  if (completionPercent > 100) {
    return 100;
  }

  return completionPercent;
}
