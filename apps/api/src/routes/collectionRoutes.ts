import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { CollectionRepository } from "../features/collections/collectionRepository.js";
import {
  parseCollectionGameOrder,
  parseCollectionOrder,
  parseCreateCollectionInput,
  parseUpdateCollectionInput,
} from "../features/collections/collectionValidation.js";

function readCollectionId(request: Request): string {
  const collectionId = request.params.collectionId;

  if (typeof collectionId !== "string" || collectionId.trim().length === 0) {
    throw new HttpError(
      400,
      "invalid_collection_id",
      "A collection ID is required.",
    );
  }

  return collectionId.trim();
}

function requireCollection<T>(collection: T | null): T {
  if (collection === null) {
    throw new HttpError(
      404,
      "collection_not_found",
      "The requested collection was not found.",
    );
  }

  return collection;
}

export function createCollectionRoutes(database: DatabaseSync): Router {
  const collectionRoutes = Router();
  const repository = new CollectionRepository(database);

  collectionRoutes.get("/", (_request, response) => {
    response.json({
      collections: repository.list(),
    });
  });

  collectionRoutes.put("/order", (request, response) => {
    const orderedCollectionIds = parseCollectionOrder(request.body);

    if (!repository.reorder(orderedCollectionIds)) {
      throw new HttpError(
        409,
        "collection_order_mismatch",
        "orderedCollectionIds must contain every collection exactly once.",
      );
    }

    response.json({
      collections: repository.list(),
    });
  });

  collectionRoutes.post("/", (request, response) => {
    const input = parseCreateCollectionInput(request.body);
    const collection = repository.create(input);

    response
      .location(`/api/collections/${collection.id}`)
      .status(201)
      .json({ collection });
  });

  collectionRoutes.get("/:collectionId", (request, response) => {
    const collection = requireCollection(
      repository.findById(readCollectionId(request)),
    );

    response.json({ collection });
  });

  collectionRoutes.patch("/:collectionId", (request, response) => {
    const input = parseUpdateCollectionInput(request.body);

    const collection = requireCollection(
      repository.update(readCollectionId(request), input),
    );

    response.json({ collection });
  });

  collectionRoutes.put("/:collectionId/games", (request, response) => {
    const collectionId = readCollectionId(request);

    requireCollection(repository.findById(collectionId));

    const orderedGameIds = parseCollectionGameOrder(request.body);

    if (!repository.replaceGames(collectionId, orderedGameIds)) {
      throw new HttpError(
        409,
        "collection_game_mismatch",
        "Every orderedGameIds entry must identify an existing library game.",
      );
    }

    response.json({
      collection: requireCollection(repository.findById(collectionId)),
    });
  });

  collectionRoutes.delete("/:collectionId", (request, response) => {
    if (!repository.deletePermanently(readCollectionId(request))) {
      throw new HttpError(
        404,
        "collection_not_found",
        "The requested collection was not found.",
      );
    }

    response.status(204).send();
  });

  return collectionRoutes;
}
