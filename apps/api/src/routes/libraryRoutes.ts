import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { LibraryGameDetailsRepository } from "../features/library/libraryGameDetailsRepository.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import { LibraryGameViewDataRepository } from "../features/library/libraryGameViewDataRepository.js";
import {
  parseCreateLibraryGameInput,
  parseLibraryGameOrder,
  parseUpdateLibraryGameInput,
} from "../features/library/libraryGameValidation.js";
import { GameResourceRepository } from "../features/resources/gameResourceRepository.js";
import {
  parseCreateGameResourceInput,
  parseGameResourceOrder,
  parseUpdateGameResourceInput,
} from "../features/resources/gameResourceValidation.js";

function readGameId(request: Request): string {
  const gameId = request.params.gameId;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new HttpError(400, "invalid_game_id", "A game ID is required.");
  }

  return gameId.trim();
}

function readResourceId(request: Request): string {
  const resourceId = request.params.resourceId;

  if (typeof resourceId !== "string" || resourceId.trim().length === 0) {
    throw new HttpError(
      400,
      "invalid_resource_id",
      "A resource ID is required.",
    );
  }

  return resourceId.trim();
}

function readIncludeHidden(value: unknown): boolean {
  if (value === undefined || value === "false") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  throw new HttpError(
    400,
    "invalid_include_hidden",
    "includeHidden must be true or false.",
  );
}

function requireGame<T>(game: T | null): T {
  if (game === null) {
    throw new HttpError(
      404,
      "game_not_found",
      "The requested library game was not found.",
    );
  }

  return game;
}

function requireResource<T>(resource: T | null): T {
  if (resource === null) {
    throw new HttpError(
      404,
      "resource_not_found",
      "The requested game resource was not found.",
    );
  }

  return resource;
}

export function createLibraryRoutes(database: DatabaseSync): Router {
  const libraryRoutes = Router();

  const repository = new LibraryGameRepository(database);
  const detailsRepository = new LibraryGameDetailsRepository(database);
  const resourceRepository = new GameResourceRepository(database);
  const viewDataRepository = new LibraryGameViewDataRepository(database);

  libraryRoutes.get("/games", (request, response) => {
    const includeHidden = readIncludeHidden(request.query.includeHidden);
    const games = repository.list(includeHidden);
    const viewDataByGameId = viewDataRepository.findAll();

    response.json({
      games: games.map((game) => ({
        ...game,
        resources: resourceRepository.listByGame(game.id),
        viewData: viewDataByGameId.get(game.id) ?? {
          collectionIds: [],
          hasPlayStationLink: false,
          alerts: [],
        },
      })),
    });
  });

  libraryRoutes.put("/games/order", (request, response) => {
    const orderedGameIds = parseLibraryGameOrder(request.body);

    if (!repository.reorder(orderedGameIds)) {
      throw new HttpError(
        409,
        "game_order_mismatch",
        "orderedGameIds must contain every visible library game exactly once.",
      );
    }

    const games = repository.list();
    const viewDataByGameId = viewDataRepository.findAll();

    response.json({
      games: games.map((game) => ({
        ...game,
        resources: resourceRepository.listByGame(game.id),
        viewData: viewDataByGameId.get(game.id) ?? {
          collectionIds: [],
          hasPlayStationLink: false,
          alerts: [],
        },
      })),
    });
  });

  libraryRoutes.get("/games/:gameId", (request, response) => {
    const game = requireGame(repository.findById(readGameId(request)));

    response.json({ game });
  });

  libraryRoutes.get("/games/:gameId/details", (request, response) => {
    const details = requireGame(
      detailsRepository.findById(readGameId(request)),
    );

    response.json({ details });
  });

  libraryRoutes.get("/games/:gameId/resources", (request, response) => {
    const gameId = readGameId(request);

    requireGame(repository.findById(gameId));

    response.json({
      resources: resourceRepository.listByGame(gameId),
    });
  });

  libraryRoutes.post("/games/:gameId/resources", (request, response) => {
    const gameId = readGameId(request);

    requireGame(repository.findById(gameId));

    const input = parseCreateGameResourceInput(request.body);

    const resource = requireResource(resourceRepository.create(gameId, input));

    response
      .location(`/api/library/games/${gameId}/resources/${resource.id}`)
      .status(201)
      .json({ resource });
  });

  libraryRoutes.put("/games/:gameId/resources/order", (request, response) => {
    const gameId = readGameId(request);

    requireGame(repository.findById(gameId));

    const orderedResourceIds = parseGameResourceOrder(request.body);

    if (!resourceRepository.reorder(gameId, orderedResourceIds)) {
      throw new HttpError(
        409,
        "resource_order_mismatch",
        "orderedResourceIds must contain every resource attached to this game exactly once.",
      );
    }

    response.json({
      resources: resourceRepository.listByGame(gameId),
    });
  });

  libraryRoutes.patch(
    "/games/:gameId/resources/:resourceId",
    (request, response) => {
      const gameId = readGameId(request);

      requireGame(repository.findById(gameId));

      const input = parseUpdateGameResourceInput(request.body);

      const resource = requireResource(
        resourceRepository.update(gameId, readResourceId(request), input),
      );

      response.json({ resource });
    },
  );

  libraryRoutes.delete(
    "/games/:gameId/resources/:resourceId",
    (request, response) => {
      const gameId = readGameId(request);

      requireGame(repository.findById(gameId));

      if (
        !resourceRepository.deletePermanently(gameId, readResourceId(request))
      ) {
        throw new HttpError(
          404,
          "resource_not_found",
          "The requested game resource was not found.",
        );
      }

      response.status(204).send();
    },
  );

  libraryRoutes.post("/games", (request, response) => {
    const input = parseCreateLibraryGameInput(request.body);

    const game = repository.create(input);

    response
      .location(`/api/library/games/${game.id}`)
      .status(201)
      .json({ game });
  });

  libraryRoutes.patch("/games/:gameId", (request, response) => {
    const input = parseUpdateLibraryGameInput(request.body);

    const game = requireGame(repository.update(readGameId(request), input));

    response.json({ game });
  });

  libraryRoutes.post("/games/:gameId/hide", (request, response) => {
    const game = requireGame(repository.hide(readGameId(request)));

    response.json({ game });
  });

  libraryRoutes.post("/games/:gameId/unhide", (request, response) => {
    const game = requireGame(repository.unhide(readGameId(request)));

    response.json({ game });
  });

  libraryRoutes.delete("/games/:gameId", (request, response) => {
    if (!repository.deletePermanently(readGameId(request))) {
      throw new HttpError(
        404,
        "game_not_found",
        "The requested library game was not found.",
      );
    }

    response.status(204).send();
  });

  return libraryRoutes;
}
