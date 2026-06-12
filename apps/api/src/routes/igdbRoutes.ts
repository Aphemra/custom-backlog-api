import { Router } from "express";
import { searchMockIgdbGames } from "../features/igdb/searchMockIgdbGames.js";

export const igdbRoutes = Router();

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
