import { igdbPost } from "./igdbApiClient.js";
import type { IgdbGameSearchResult } from "./igdbSearchTypes.js";

interface SearchRealIgdbGamesInput {
  query: string;
  limit?: number;
}

interface RawIgdbGame {
  id?: unknown;
  name?: unknown;
  platforms?: unknown;
  first_release_date?: unknown;
  cover?: unknown;
}

interface RawIgdbPlatform {
  name?: unknown;
}

interface RawIgdbCover {
  image_id?: unknown;
}

export async function searchRealIgdbGames({ query, limit = 10 }: SearchRealIgdbGamesInput): Promise<IgdbGameSearchResult[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const safeLimit = clampLimit(limit);
  const queryBody = buildGameSearchQuery(trimmedQuery, safeLimit);

  const rawGames = await igdbPost<unknown>("games", queryBody);

  return parseRawIgdbGames(rawGames);
}

function buildGameSearchQuery(query: string, limit: number): string {
  const escapedQuery = escapeIgdbSearchText(query);

  return [`search "${escapedQuery}";`, "fields name, platforms.name, first_release_date, cover.image_id;", `limit ${limit};`].join("\n");
}

function parseRawIgdbGames(data: unknown): IgdbGameSearchResult[] {
  if (!Array.isArray(data)) {
    throw new Error("IGDB games response was not an array.");
  }

  return data.map(parseRawIgdbGame).filter((game): game is IgdbGameSearchResult => game !== null);
}

function parseRawIgdbGame(data: unknown): IgdbGameSearchResult | null {
  if (!isRecord(data)) {
    return null;
  }

  const rawGame = data as RawIgdbGame;

  if (typeof rawGame.id !== "number" || typeof rawGame.name !== "string") {
    return null;
  }

  const firstReleaseYear = parseReleaseYear(rawGame.first_release_date);
  const coverUrl = parseCoverUrl(rawGame.cover);

  return {
    id: rawGame.id,
    name: rawGame.name,
    platforms: parsePlatformNames(rawGame.platforms),
    ...(firstReleaseYear !== undefined ? { firstReleaseYear } : {}),
    ...(coverUrl !== undefined ? { coverUrl } : {}),
    source: "igdb",
  };
}

function parsePlatformNames(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) {
    return [];
  }

  return platforms
    .map((platform) => {
      if (!isRecord(platform)) {
        return null;
      }

      const rawPlatform = platform as RawIgdbPlatform;

      return typeof rawPlatform.name === "string" ? rawPlatform.name : null;
    })
    .filter((platformName): platformName is string => platformName !== null);
}

function parseReleaseYear(firstReleaseDate: unknown): number | undefined {
  if (typeof firstReleaseDate !== "number") {
    return undefined;
  }

  const date = new Date(firstReleaseDate * 1000);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.getUTCFullYear();
}

function parseCoverUrl(cover: unknown): string | undefined {
  if (!isRecord(cover)) {
    return undefined;
  }

  const rawCover = cover as RawIgdbCover;

  if (typeof rawCover.image_id !== "string") {
    return undefined;
  }

  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${rawCover.image_id}.png`;
}

function escapeIgdbSearchText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function clampLimit(limit: number): number {
  if (!Number.isInteger(limit)) {
    return 10;
  }

  if (limit < 1) {
    return 1;
  }

  if (limit > 25) {
    return 25;
  }

  return limit;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
