import type { IgdbGameSearchResult } from "./igdbSearchTypes.js";

const noisyTitlePhrases = [
  "anniversary edition",
  "atlus brand",
  "collector's edition",
  "collectors edition",
  "deluxe edition",
  "digital deluxe",
  "digital edition",
  "digital anniversary",
  "guidebook edition",
  "launch edition",
  "premium edition",
  "ultimate edition",
  "upgrade",
];

export function filterIgdbSearchResultsToBaseGameCandidates(games: IgdbGameSearchResult[]): IgdbGameSearchResult[] {
  return games.filter((game) => !isNoisyGameTitle(game.name));
}

function isNoisyGameTitle(title: string): boolean {
  const normalizedTitle = normalizeTitle(title);

  return noisyTitlePhrases.some((phrase) => normalizedTitle.includes(phrase));
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
