import type { IgdbGameSearchResult } from "./igdbSearchTypes.js";

const ownedPlayStationPlatformNames = new Set(["playstation 3", "ps3", "playstation 4", "ps4", "playstation 5", "ps5"]);

export function filterIgdbSearchResultsToSonyConsoles(games: IgdbGameSearchResult[], limit: number): IgdbGameSearchResult[] {
  return games
    .map((game) => ({
      ...game,
      platforms: getOwnedPlayStationPlatformNames(game.platforms),
    }))
    .filter((game) => game.platforms.length > 0)
    .slice(0, limit);
}

function getOwnedPlayStationPlatformNames(platformNames: string[]): string[] {
  const playStationNames = platformNames.filter(isOwnedPlayStationPlatformName);

  return Array.from(new Set(playStationNames));
}

function isOwnedPlayStationPlatformName(platformName: string): boolean {
  return ownedPlayStationPlatformNames.has(normalizePlatformName(platformName));
}

function normalizePlatformName(platformName: string): string {
  return platformName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
