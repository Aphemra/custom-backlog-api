import { Router } from "express";
import { searchMockIgdbGames } from "../features/igdb/searchMockIgdbGames.js";
import { getIgdbIntegrationStatus } from "../features/igdb/getIgdbIntegrationStatus.js";
import { getCachedIgdbAccessTokenStatus, getIgdbAccessToken } from "../features/igdb/igdbAccessTokenService.js";

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

igdbRoutes.get("/search", (request, response) => {
  const query = typeof request.query.query === "string" ? request.query.query : "";

  const limit = parseLimit(request.query.limit);

  const games = searchMockIgdbGames({
    query,
    limit,
  });

  response.json({
    query,
    count: games.length,
    games,
  });
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
