import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../features/imageCache/imageCacheService.js";
import { IgdbClient, type IgdbFetch } from "../features/igdb/igdbClient.js";
import { IgdbImportService } from "../features/igdb/igdbImportService.js";
import { IgdbSearchService } from "../features/igdb/igdbSearchService.js";
import type {
  AddIgdbGameInput,
  IgdbCredentials,
} from "../features/igdb/igdbTypes.js";
import {
  playStationPlatforms,
  pursuitStatuses,
  type PlayStationPlatform,
  type PursuitStatus,
} from "../features/library/libraryGameTypes.js";

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

function readIncludeDlc(value: unknown): boolean {
  if (value === undefined || value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  throw new HttpError(
    400,
    "invalid_include_dlc",
    "includeDlc must be true or false.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExternalId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,15}$/.test(value)) {
    throw new HttpError(
      400,
      "invalid_igdb_game_id",
      "A valid IGDB game ID is required.",
    );
  }

  return value;
}

function readAddInput(externalId: string, value: unknown): AddIgdbGameInput {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "invalid_igdb_add_input",
      "The IGDB add request must be an object.",
    );
  }

  const allowedKeys = new Set(["platform", "pursuitStatus"]);

  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw new HttpError(
      400,
      "unknown_igdb_add_field",
      "The IGDB add request contains an unknown field.",
    );
  }

  if (
    typeof value.platform !== "string" ||
    !playStationPlatforms.includes(value.platform as PlayStationPlatform)
  ) {
    throw new HttpError(
      400,
      "invalid_platform",
      "platform must be PS3, PS4, or PS5.",
    );
  }

  const pursuitStatus = value.pursuitStatus ?? "unplanned";

  if (
    typeof pursuitStatus !== "string" ||
    !pursuitStatuses.includes(pursuitStatus as PursuitStatus)
  ) {
    throw new HttpError(
      400,
      "invalid_pursuit_status",
      "pursuitStatus is not supported.",
    );
  }

  return {
    externalId,
    platform: value.platform as PlayStationPlatform,
    pursuitStatus: pursuitStatus as PursuitStatus,
  };
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

  const client = new IgdbClient(credentials, fetchIgdb);
  const searchService = new IgdbSearchService(client, imageCache);
  const importService = new IgdbImportService(database, client, imageCache);

  igdbRoutes.get("/games", async (request, response, next) => {
    try {
      const games = await searchService.search(
        readSearchTerm(request.query.query),
        readIncludeDlc(request.query.includeDlc),
      );

      response.json({ games });
    } catch (error) {
      next(error);
    }
  });

  igdbRoutes.post(
    "/games/:externalId/library",
    async (request, response, next) => {
      try {
        const externalId = readExternalId(request.params.externalId);
        const input = readAddInput(externalId, request.body);
        const game = await importService.addToLibrary(input);

        response
          .location(`/api/library/games/${game.id}`)
          .status(201)
          .json({ game });
      } catch (error) {
        next(error);
      }
    },
  );

  return igdbRoutes;
}
