import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import {
  parseCreateLibraryGameInput,
  parseLibraryGameOrder,
  parseUpdateLibraryGameInput,
} from "../features/library/libraryGameValidation.js";

function readGameId(request: Request): string {
  const gameId = request.params.gameId;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new HttpError(400, "invalid_game_id", "A game ID is required.");
  }

  return gameId.trim();
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

export function createLibraryRoutes(database: DatabaseSync): Router {
  const libraryRoutes = Router();

  const repository = new LibraryGameRepository(database);

  libraryRoutes.get("/games", (request, response) => {
    const includeHidden = readIncludeHidden(request.query.includeHidden);

    response.json({
      games: repository.list(includeHidden),
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

    response.json({
      games: repository.list(),
    });
  });

  libraryRoutes.get("/games/:gameId", (request, response) => {
    const game = requireGame(repository.findById(readGameId(request)));

    response.json({ game });
  });

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
