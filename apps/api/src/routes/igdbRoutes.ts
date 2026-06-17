import { Router } from "express";
import { getCachedIgdbAccessTokenStatus, getIgdbAccessToken } from "../features/igdb/igdbAccessTokenService.js";
import { getIgdbIntegrationStatus } from "../features/igdb/getIgdbIntegrationStatus.js";
import { searchIgdbGames } from "../features/igdb/searchIgdbGames.js";

export const igdbRoutes = Router();

igdbRoutes.get("/status", (_request, response) => {
  response.json(getIgdbIntegrationStatus());
});

igdbRoutes.get("/auth-check", async (_request, response) => {
  try {
    await getIgdbAccessToken();

    response.json({
      ok: true,
      tokenAvailable: true,
      tokenStatus: getCachedIgdbAccessTokenStatus(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IGDB auth-check failure.";

    response.status(503).json({
      ok: false,
      tokenAvailable: false,
      message,
      tokenStatus: getCachedIgdbAccessTokenStatus(),
    });
  }
});

igdbRoutes.get("/search", async (request, response) => {
  const query = typeof request.query.query === "string" ? request.query.query : "";

  const limit = parseLimit(request.query.limit);

  try {
    const searchResult = await searchIgdbGames({
      query,
      limit,
    });

    response.json({
      query,
      source: searchResult.source,
      count: searchResult.games.length,
      games: searchResult.games,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IGDB search failure.";

    response.status(502).json({
      error: "igdb_search_failed",
      message,
    });
  }
});

function parseLimit(value: unknown): number {
  if (typeof value !== "string") {
    return 10;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    return 10;
  }

  if (parsedValue < 1) {
    return 1;
  }

  if (parsedValue > 25) {
    return 25;
  }

  return parsedValue;
}
