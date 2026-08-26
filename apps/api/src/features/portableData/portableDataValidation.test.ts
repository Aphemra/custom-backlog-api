import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
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

    return createPortableDataExport(database);
  } finally {
    database.close();
  }
}

test("accepts a complete version-three portable export", () => {
  const portableData = createValidExport();

  assert.deepEqual(parsePortableDataExport(portableData), portableData);
});

test("rejects unsupported versions and broken collection references", () => {
  const unsupportedVersion = structuredClone(
    createValidExport(),
  ) as unknown as {
    formatVersion: number;
  };

  unsupportedVersion.formatVersion = 4;

  assert.throws(
    () => parsePortableDataExport(unsupportedVersion),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === "unsupported_portable_data_version",
  );

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
});

test("continues to accept version-one and version-two exports", () => {
  const versionThree = createValidExport();

  const versionOne = {
    format: versionThree.format,
    formatVersion: 1 as const,
    exportedAt: versionThree.exportedAt,

    data: {
      libraryGames: versionThree.data.libraryGames,
      collections: versionThree.data.collections,
    },
  };

  const versionTwo = {
    format: versionThree.format,
    formatVersion: 2 as const,
    exportedAt: versionThree.exportedAt,

    data: {
      libraryGames: versionThree.data.libraryGames,
      collections: versionThree.data.collections,
      savedViews: versionThree.data.savedViews,
    },
  };

  assert.deepEqual(parsePortableDataExport(versionOne), versionOne);

  assert.deepEqual(parsePortableDataExport(versionTwo), versionTwo);
});
