import type { PlatformId } from "./platform";
import type { PlayStatus } from "./backlog";
import type { TrophyStatus } from "./trophy";
import { playstationPlatforms } from "../data/mock/playstationPlatforms";

export function getPlatformShortName(platformId: PlatformId): string {
  const platform = playstationPlatforms.find((item) => item.id === platformId);
  return platform?.shortName ?? platformId;
}

export function formatPlayStatus(status: PlayStatus): string {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "playing":
      return "Playing";
    case "beaten":
      return "Beaten";
    case "completed":
      return "Completed";
    case "shelved":
      return "Shelved";
    case "abandoned":
      return "Abandoned";
  }
}

export function formatTrophyStatus(status: TrophyStatus): string {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "started":
      return "Started";
    case "cleanup":
      return "Cleanup";
    case "platinumed":
      return "Platinumed";
    case "hundred_percent":
      return "100% Complete";
    case "skipped":
      return "Skipped";
    case "unobtainable":
      return "Unobtainable";
    case "not_applicable":
      return "N/A";
  }
}
