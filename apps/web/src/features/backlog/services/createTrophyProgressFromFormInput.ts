import type { TrophyProgress } from "../../../domain/trophy";
import { normalizeTrophyProgress } from "./trophyProgressHelpers";

interface CreateTrophyProgressFromFormInput {
  completionPercent?: number;
  earnedTrophies?: number;
  totalTrophies?: number;
  platinumEarned: boolean;
  psnProfilesUrl: string;
  lastSyncedAt?: string;
}

export function createTrophyProgressFromFormInput({
  completionPercent,
  earnedTrophies,
  totalTrophies,
  platinumEarned,
  psnProfilesUrl,
  lastSyncedAt,
}: CreateTrophyProgressFromFormInput): TrophyProgress {
  const trimmedPsnProfilesUrl = psnProfilesUrl.trim();

  return normalizeTrophyProgress({
    ...(completionPercent !== undefined ? { completionPercent } : {}),
    ...(earnedTrophies !== undefined ? { earnedTrophies } : {}),
    ...(totalTrophies !== undefined ? { totalTrophies } : {}),
    platinumEarned,
    ...(trimmedPsnProfilesUrl ? { psnProfilesUrl: trimmedPsnProfilesUrl } : {}),
    ...(lastSyncedAt !== undefined ? { lastSyncedAt } : {}),
  });
}
