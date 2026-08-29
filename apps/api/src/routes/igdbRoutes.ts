import type { DatabaseSync } from "node:sqlite";
import { Router } from "express";
import { HttpError } from "../errors/httpError.js";
import { ImageCacheRepository } from "../features/imageCache/imageCacheRepository.js";
import { ImageCacheService } from "../features/imageCache/imageCacheService.js";
import { IgdbClient, type IgdbFetch } from "../features/igdb/igdbClient.js";
import { IgdbImportService } from "../features/igdb/igdbImportService.js";
import { IgdbSearchService } from "../features/igdb/igdbSearchService.js";
import { IgdbEnrichmentService } from "../features/igdb/igdbEnrichmentService.js";
import { normalizeIgdbSearchTerm } from "../features/igdb/igdbSearchTerm.js";
import type {
  AddIgdbGameInput,
  IgdbCredentials,
  IgdbSearchOptions,
  IgdbSearchScope,
} from "../features/igdb/igdbTypes.js";
import { igdbSearchScopes } from "../features/igdb/igdbTypes.js";
import {
  playStationPlatforms,
  playStatuses,
  type PlayStationPlatform,
  type PlayStatus,
} from "../features/library/libraryGameTypes.js";

function readSearchTerm(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_igdb_search",
      "query must produce between 2 and 100 searchable characters.",
    );
  }

  const searchTerm = normalizeIgdbSearchTerm(value);

  if (searchTerm.length < 2 || searchTerm.length > 100) {
    throw new HttpError(
      400,
      "invalid_igdb_search",
      "query must produce between 2 and 100 searchable characters.",
    );
  }

  return searchTerm;
}

function readSearchPlatform(value: unknown): PlayStationPlatform | null {
  if (value === undefined || value === "all") {
    return null;
  }

  if (
    typeof value === "string" &&
    playStationPlatforms.includes(value as PlayStationPlatform)
  ) {
    return value as PlayStationPlatform;
  }

  throw new HttpError(
    400,
    "invalid_igdb_platform",
    "platform must be all, PS3, PS4, or PS5.",
  );
}

function readSearchScope(value: unknown): IgdbSearchScope {
  if (value === undefined) {
    return "games";
  }

  if (
    typeof value === "string" &&
    igdbSearchScopes.includes(value as IgdbSearchScope)
  ) {
    return value as IgdbSearchScope;
  }

  throw new HttpError(
    400,
    "invalid_igdb_search_scope",
    "scope is not a supported IGDB search scope.",
  );
}

function readSearchOptions(query: Record<string, unknown>): IgdbSearchOptions {
  return {
    platform: readSearchPlatform(query.platform),
    scope: readSearchScope(query.scope),
  };
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

function readLibraryGameId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 200) {
    throw new HttpError(
      400,
      "invalid_game_id",
      "A valid library game ID is required.",
    );
  }

  return value.trim();
}

function readAddInput(externalId: string, value: unknown): AddIgdbGameInput {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "invalid_igdb_add_input",
      "The IGDB add request must be an object.",
    );
  }

  const allowedKeys = new Set(["platform", "playStatus"]);

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

  let playStatus: PlayStatus = "not_started";

  if (value.playStatus !== undefined) {
    if (
      typeof value.playStatus !== "string" ||
      !playStatuses.includes(value.playStatus as PlayStatus)
    ) {
      throw new HttpError(
        400,
        "invalid_play_status",
        "playStatus is not supported.",
      );
    }

    playStatus = value.playStatus as PlayStatus;
  }

  return {
    externalId,
    platform: value.platform as PlayStationPlatform,
    playStatus,
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
  const enrichmentService = new IgdbEnrichmentService(
    database,
    client,
    imageCache,
  );

  igdbRoutes.get("/games", async (request, response, next) => {
    try {
      const games = await searchService.search(
        readSearchTerm(request.query.query),
        readSearchOptions(request.query),
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

  igdbRoutes.post(
    "/games/:externalId/library/:gameId/metadata",
    async (request, response, next) => {
      if (
        request.get("x-trophy-backlog-action") !==
        "enrich-library-game-from-igdb"
      ) {
        response.status(400).json({
          ok: false,
          error: "explicit_igdb_action_required",
          message: "An explicit IGDB metadata-enrichment action is required.",
        });

        return;
      }

      try {
        const externalId = readExternalId(request.params.externalId);

        const gameId = readLibraryGameId(request.params.gameId);

        const result = await enrichmentService.enrichExistingGame(
          gameId,
          externalId,
        );

        response.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  igdbRoutes.post(
    "/library/:gameId/metadata-refresh",
    async (request, response, next) => {
      if (
        request.get("x-trophy-backlog-action") !==
        "refresh-library-game-from-igdb"
      ) {
        response.status(400).json({
          ok: false,
          error: "explicit_igdb_action_required",
          message: "An explicit IGDB metadata-refresh action is required.",
        });

        return;
      }

      try {
        const gameId = readLibraryGameId(request.params.gameId);

        const result = await enrichmentService.refreshExistingGame(gameId);

        response.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return igdbRoutes;
}
