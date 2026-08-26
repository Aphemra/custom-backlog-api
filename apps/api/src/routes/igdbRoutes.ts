import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../features/imageCache/imageCacheService.js";
import { IgdbClient, type IgdbFetch } from "../features/igdb/igdbClient.js";
import { IgdbSearchService } from "../features/igdb/igdbSearchService.js";
import type { IgdbCredentials } from "../features/igdb/igdbTypes.js";

function readSearchTerm(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_igdb_search",
      "query must be a string between 2 and 100 characters.",
    );
  }

  const searchTerm = value.trim();

  if (searchTerm.length < 2 || searchTerm.length > 100) {
    throw new HttpError(
      400,
      "invalid_igdb_search",
      "query must be a string between 2 and 100 characters.",
    );
  }

  return searchTerm;
}

export function createIgdbRoutes(
  database: DatabaseSync,
  cacheDirectory: string,
  credentials: IgdbCredentials,
  fetchIgdb: IgdbFetch = fetch,
): Router {
  const igdbRoutes = Router();

  const imageCache = new ImageCacheService(
    new ImageCacheRepository(database),
    cacheDirectory,
    fetchIgdb,
  );

  const searchService = new IgdbSearchService(
    new IgdbClient(credentials, fetchIgdb),
    imageCache,
  );

  igdbRoutes.get("/games", async (request, response, next) => {
    try {
      const games = await searchService.search(
        readSearchTerm(request.query.query),
      );

      response.json({ games });
    } catch (error) {
      next(error);
    }
  });

  return igdbRoutes;
}
