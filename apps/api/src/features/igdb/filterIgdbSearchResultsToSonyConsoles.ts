import type { IgdbGameSearchResult } from "./igdbSearchTypes.js";

const sonyPlatformNames = new Set([
  "playstation",
  "ps1",

  "playstation 2",
  "ps2",

  "playstation 3",
  "ps3",

  "playstation 4",
  "ps4",

  "playstation 5",
  "ps5",

  "playstation portable",
  "psp",

  "playstation vita",
  "ps vita",
  "vita",

  "playstation vr",
  "ps vr",
  "psvr",

  "playstation vr2",
  "playstation vr 2",
  "ps vr2",
  "ps vr 2",
  "psvr2",
]);

export function filterIgdbSearchResultsToSonyConsoles(games: IgdbGameSearchResult[], limit: number): IgdbGameSearchResult[] {
  return games
    .map((game) => ({
      ...game,
      platforms: getSonyPlatformNames(game.platforms),
    }))
    .filter((game) => game.platforms.length > 0)
    .slice(0, limit);
}

function getSonyPlatformNames(platformNames: string[]): string[] {
  const sonyNames = platformNames.filter(isSonyPlatformName);

  return Array.from(new Set(sonyNames));
}

function isSonyPlatformName(platformName: string): boolean {
  return sonyPlatformNames.has(normalizePlatformName(platformName));
}

function normalizePlatformName(platformName: string): string {
  return platformName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
