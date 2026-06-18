import type { TrophyProgress } from "../../../domain/trophy";

export interface NormalizedTrophyProgress extends TrophyProgress {
  completionPercent: number;
  earnedTrophies: number;
  totalTrophies: number;
}

export function calculateTrophyCompletionPercent({ earnedTrophies, totalTrophies }: { earnedTrophies: number; totalTrophies: number }): number {
  if (totalTrophies <= 0) {
    return 0;
  }

  const rawPercent = Math.round((earnedTrophies / totalTrophies) * 100);

  return clampNumber(rawPercent, 0, 100);
}

export function normalizeTrophyProgress(trophyProgress: TrophyProgress): NormalizedTrophyProgress {
  const earnedTrophies = trophyProgress.earnedTrophies ?? 0;
  const totalTrophies = trophyProgress.totalTrophies ?? 0;
  const completionPercent =
    trophyProgress.completionPercent ??
    calculateTrophyCompletionPercent({
      earnedTrophies,
      totalTrophies,
    });

  return {
    completionPercent: clampNumber(completionPercent, 0, 100),
    earnedTrophies: clampNumber(earnedTrophies, 0, Number.MAX_SAFE_INTEGER),
    totalTrophies: clampNumber(totalTrophies, 0, Number.MAX_SAFE_INTEGER),
    ...(trophyProgress.platinumEarned !== undefined ? { platinumEarned: trophyProgress.platinumEarned } : {}),
    ...(trophyProgress.psnProfilesUrl !== undefined ? { psnProfilesUrl: trophyProgress.psnProfilesUrl } : {}),
    ...(trophyProgress.lastSyncedAt !== undefined ? { lastSyncedAt: trophyProgress.lastSyncedAt } : {}),
  };
}

export function isTrophyProgressNumericallyComplete(trophyProgress: TrophyProgress): boolean {
  const normalizedProgress = normalizeTrophyProgress(trophyProgress);

  return (
    normalizedProgress.totalTrophies > 0 &&
    normalizedProgress.earnedTrophies >= normalizedProgress.totalTrophies &&
    normalizedProgress.completionPercent >= 100
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
