import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { LibraryGameViewDataRepository } from "../features/library/libraryGameViewDataRepository.js";
import { GameResourceRepository } from "../features/resources/gameResourceRepository.js";
import { SavedViewRepository } from "../features/savedViews/savedViewRepository.js";
import {
  parseCreateSavedViewInput,
  parseSavedViewOrder,
  parseUpdateSavedViewInput,
} from "../features/savedViews/savedViewValidation.js";

function readViewId(request: Request): string {
  const viewId = request.params.viewId;

  if (typeof viewId !== "string" || viewId.trim().length === 0) {
    throw new HttpError(
      400,
      "invalid_saved_view_id",
      "A saved view ID is required.",
    );
  }

  return viewId.trim();
}

function readSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length > 200) {
    throw new HttpError(
      400,
      "invalid_search",
      "search must not exceed 200 characters.",
    );
  }

  return value;
}

export function createSavedViewRoutes(database: DatabaseSync): Router {
  const routes = Router();

  const repository = new SavedViewRepository(database);
  const resourceRepository = new GameResourceRepository(database);
  const viewDataRepository = new LibraryGameViewDataRepository(database);

  routes.get("/", (_request, response) => {
    response.json({
      views: repository.list(),
    });
  });

  routes.put("/order", (request, response) => {
    const orderedViewIds = parseSavedViewOrder(request.body);

    if (!repository.reorder(orderedViewIds)) {
      throw new HttpError(
        409,
        "saved_view_order_mismatch",
        "orderedViewIds must contain every saved view exactly once.",
      );
    }

    response.json({
      views: repository.list(),
    });
  });

  routes.post("/", (request, response) => {
    const input = parseCreateSavedViewInput(request.body);

    if (!repository.collectionIdsExist(input.filters)) {
      throw new HttpError(
        409,
        "saved_view_collection_not_found",
        "Every collectionIds entry must identify an existing Collection.",
      );
    }

    const view = repository.create(input);

    response.location(`/api/saved-views/${view.id}`).status(201).json({ view });
  });

  routes.get("/:viewId/games", (request, response) => {
    const viewId = readViewId(request);

    const view = repository.findById(viewId);

    if (view === null) {
      throw new HttpError(
        404,
        "saved_view_not_found",
        "The requested saved view was not found.",
      );
    }

    const games = repository.listGames(view, readSearch(request.query.search));
    const viewDataByGameId = viewDataRepository.findAll();

    response.json({
      view,
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

  routes.patch("/:viewId", (request, response) => {
    const viewId = readViewId(request);

    const current = repository.findById(viewId);

    if (current === null) {
      throw new HttpError(
        404,
        "saved_view_not_found",
        "The requested saved view was not found.",
      );
    }

    if (current.isBuiltin) {
      throw new HttpError(
        409,
        "builtin_saved_view",
        "Built-in saved views cannot be edited.",
      );
    }

    const input = parseUpdateSavedViewInput(request.body);

    if (
      input.filters !== undefined &&
      !repository.collectionIdsExist(input.filters)
    ) {
      throw new HttpError(
        409,
        "saved_view_collection_not_found",
        "Every collectionIds entry must identify an existing Collection.",
      );
    }

    response.json({
      view: repository.update(viewId, input),
    });
  });

  routes.delete("/:viewId", (request, response) => {
    const viewId = readViewId(request);

    const current = repository.findById(viewId);

    if (current === null) {
      throw new HttpError(
        404,
        "saved_view_not_found",
        "The requested saved view was not found.",
      );
    }

    if (current.isBuiltin) {
      throw new HttpError(
        409,
        "builtin_saved_view",
        "Built-in saved views cannot be deleted.",
      );
    }

    repository.delete(viewId);

    response.status(204).send();
  });

  return routes;
}
