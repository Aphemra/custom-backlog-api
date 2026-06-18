import type { PlatformId } from "../../../domain/platform";

const platformNameToPlatformId = new Map<string, PlatformId>([
  ["playstation 3", "ps3"],
  ["ps3", "ps3"],

  ["playstation 4", "ps4"],
  ["ps4", "ps4"],

  ["playstation 5", "ps5"],
  ["ps5", "ps5"],
]);

export function mapIgdbPlatformsToPlatformIds(platformNames: string[]): PlatformId[] {
  const platformIds = platformNames
    .map((platformName) => platformNameToPlatformId.get(normalizePlatformName(platformName)))
    .filter((platformId): platformId is PlatformId => platformId !== undefined);

  return Array.from(new Set(platformIds));
}

function normalizePlatformName(platformName: string): string {
  return platformName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
