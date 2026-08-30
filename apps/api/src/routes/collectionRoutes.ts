import type { DatabaseSync } from "node:sqlite";
import { Router, type Request } from "express";
import { HttpError } from "../errors/httpError.js";
import { CollectionRepository } from "../features/collections/collectionRepository.js";
import { BacklogActivityRecorder } from "../features/history/backlogActivityRecorder.js";
import { LibraryGameRepository } from "../features/library/libraryGameRepository.js";
import { SavedViewRepository } from "../features/savedViews/savedViewRepository.js";
import {
  parseCollectionGameOrder,
  parseCollectionOrder,
  parseCreateCollectionInput,
  parseGameCollectionMemberships,
  parsePinnedCollection,
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

function readGameId(request: Request): string {
  const gameId = request.params.gameId;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new HttpError(400, "invalid_game_id", "A game ID is required.");
  }

  return gameId.trim();
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

export function createCollectionRoutes(database: DatabaseSync): Router {
  const collectionRoutes = Router();
  const repository = new CollectionRepository(database);
  const games = new LibraryGameRepository(database);
  const activity = new BacklogActivityRecorder(database);
  const savedViews = new SavedViewRepository(database);

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

    activity.recordCollectionsReordered(orderedCollectionIds.length);

    response.json({
      collections: repository.list(),
    });
  });

  collectionRoutes.put("/pinned", (request, response) => {
    const collectionId = parsePinnedCollection(request.body);
    const previouslyPinned =
      repository.list().find((collection) => collection.isPinned) ?? null;

    if (collectionId !== null && repository.findById(collectionId) === null) {
      throw new HttpError(
        404,
        "collection_not_found",
        "The Collection selected for pinning was not found.",
      );
    }

    const collection = repository.setPinned(collectionId);

    activity.recordPinnedCollectionChanged(previouslyPinned, collection);

    response.json({ collection });
  });

  collectionRoutes.post("/", (request, response) => {
    const input = parseCreateCollectionInput(request.body);
    const collection = repository.create(input);

    activity.recordCollectionCreated(collection);

    response
      .location(`/api/collections/${collection.id}`)
      .status(201)
      .json({ collection });
  });

  collectionRoutes.put("/memberships/:gameId", (request, response) => {
    const gameId = readGameId(request);
    const game = requireGame(games.findById(gameId));
    const collectionIds = parseGameCollectionMemberships(request.body);
    const collections = repository.list();
    const collectionsById = new Map(
      collections.map((collection) => [collection.id, collection]),
    );

    const previousCollectionIds = new Set(
      collections
        .filter((collection) =>
          repository
            .findById(collection.id)
            ?.games.some((member) => member.id === gameId),
        )
        .map((collection) => collection.id),
    );

    if (!repository.replaceGameMemberships(gameId, collectionIds)) {
      throw new HttpError(
        409,
        "collection_membership_mismatch",
        "The game and every collectionIds entry must identify existing records.",
      );
    }

    const nextCollectionIds = new Set(collectionIds);

    for (const collectionId of previousCollectionIds) {
      if (nextCollectionIds.has(collectionId)) {
        continue;
      }

      const collection = collectionsById.get(collectionId);

      if (collection !== undefined) {
        activity.recordCollectionMembershipChanged(game, collection, false);
      }
    }

    for (const collectionId of nextCollectionIds) {
      if (previousCollectionIds.has(collectionId)) {
        continue;
      }

      const collection = collectionsById.get(collectionId);

      if (collection !== undefined) {
        activity.recordCollectionMembershipChanged(game, collection, true);
      }
    }

    response.json({ collectionIds });
  });

  collectionRoutes.get("/:collectionId", (request, response) => {
    const collection = requireCollection(
      repository.findById(readCollectionId(request)),
    );

    response.json({ collection });
  });

  collectionRoutes.patch("/:collectionId", (request, response) => {
    const collectionId = readCollectionId(request);
    const input = parseUpdateCollectionInput(request.body);
    const previousCollection = requireCollection(
      repository.findById(collectionId),
    );
    const collection = requireCollection(
      repository.update(collectionId, input),
    );

    activity.recordCollectionUpdated(previousCollection, collection);

    response.json({ collection });
  });

  collectionRoutes.put("/:collectionId/games", (request, response) => {
    const collectionId = readCollectionId(request);
    const previousCollection = requireCollection(
      repository.findById(collectionId),
    );
    const orderedGameIds = parseCollectionGameOrder(request.body);

    if (!repository.replaceGames(collectionId, orderedGameIds)) {
      throw new HttpError(
        409,
        "collection_game_mismatch",
        "Every orderedGameIds entry must identify an existing library game.",
      );
    }

    const collection = requireCollection(repository.findById(collectionId));
    const previousGamesById = new Map(
      previousCollection.games.map((game) => [game.id, game]),
    );
    const nextGamesById = new Map(
      collection.games.map((game) => [game.id, game]),
    );

    for (const [gameId, game] of previousGamesById) {
      if (!nextGamesById.has(gameId)) {
        activity.recordCollectionMembershipChanged(game, collection, false);
      }
    }

    for (const [gameId, game] of nextGamesById) {
      if (!previousGamesById.has(gameId)) {
        activity.recordCollectionMembershipChanged(game, collection, true);
      }
    }

    const membershipChanged =
      previousGamesById.size !== nextGamesById.size ||
      [...previousGamesById.keys()].some(
        (gameId) => !nextGamesById.has(gameId),
      );

    const orderChanged =
      previousCollection.games.length === collection.games.length &&
      previousCollection.games.some(
        (game, index) => collection.games[index]?.id !== game.id,
      );

    if (!membershipChanged && orderChanged) {
      activity.recordCollectionGamesReordered(
        collection,
        collection.games.length,
      );
    }

    response.json({ collection });
  });

  collectionRoutes.delete("/:collectionId", (request, response) => {
    const collectionId = readCollectionId(request);
    const collection = requireCollection(repository.findById(collectionId));

    const dependentViews = savedViews.listUsingCollection(collectionId);

    if (dependentViews.length > 0) {
      throw new HttpError(
        409,
        "collection_used_by_saved_view",
        "Remove this Collection from its saved views before deleting it.",
      );
    }

    if (!repository.deletePermanently(collectionId)) {
      throw new HttpError(
        404,
        "collection_not_found",
        "The requested collection was not found.",
      );
    }

    activity.recordCollectionDeleted(collection);

    response.status(204).send();
  });

  return collectionRoutes;
}
