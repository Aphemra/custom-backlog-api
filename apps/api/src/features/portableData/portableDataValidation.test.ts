import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { GameResourceRepository } from "../resources/gameResourceRepository.js";
import { createPortableDataExport } from "./portableDataService.js";
import { parsePortableDataExport } from "./portableDataValidation.js";

function createValidExport() {
  const database = openDatabase(":memory:");

  try {
    const games = new LibraryGameRepository(database);

    const collections = new CollectionRepository(database);

    const game = games.create({
      title: "Astro Bot",
      platform: "PS5",
    });

    const collection = collections.create({
      name: "Platformers",
    });

    collections.replaceGames(collection.id, [game.id]);

    new GameResourceRepository(database).create(game.id, {
      resourceType: "guide",
      url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
    });

    return createPortableDataExport(database);
  } finally {
    database.close();
  }
}

test("accepts the current portable export", () => {
  const portableData = createValidExport();

  assert.deepEqual(parsePortableDataExport(portableData), portableData);
});

test("rejects unsupported versions and broken collection references", () => {
  for (const formatVersion of [1, 2, 3, 4, 6]) {
    const unsupportedVersion = structuredClone(
      createValidExport(),
    ) as unknown as {
      formatVersion: number;
    };

    unsupportedVersion.formatVersion = formatVersion;

    assert.throws(
      () => parsePortableDataExport(unsupportedVersion),
      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "unsupported_portable_data_version",
    );
  }

  const brokenReference = structuredClone(createValidExport()) as unknown as {
    data: {
      collections: Array<{
        orderedGameIds: string[];
      }>;
    };
  };

  brokenReference.data.collections[0]?.orderedGameIds.push("missing-game");

  assert.throws(
    () => parsePortableDataExport(brokenReference),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_portable_data",
  );

  const brokenResourceReference = structuredClone(createValidExport());

  const firstResource = brokenResourceReference.data.gameResources[0];

  assert.notEqual(firstResource, undefined);

  if (firstResource === undefined) {
    throw new Error("Expected the portable fixture to contain a resource.");
  }

  (
    firstResource as {
      gameId: string;
    }
  ).gameId = "missing-game";

  assert.throws(
    () => parsePortableDataExport(brokenResourceReference),
    (error: unknown) =>
      error instanceof HttpError && error.code === "invalid_portable_data",
  );
});
