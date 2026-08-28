import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { GameResourceRepository } from "../resources/gameResourceRepository.js";
import { createCompatiblePursuitStatus } from "../library/libraryGameTypes.js";
import type { PortableLibraryGame } from "./portableDataTypes.js";
import type { PortableLibraryGameV4 } from "./portableDataV4Types.js";
import { SavedViewRepository } from "../savedViews/savedViewRepository.js";
import {
  createPortableDataExport,
  importPortableData,
  previewPortableImport,
} from "./portableDataService.js";
import { parsePortableDataExport } from "./portableDataValidation.js";

function createLegacyPortableLibraryGames(
  games: readonly PortableLibraryGameV4[],
): readonly PortableLibraryGame[] {
  return games.map((game) => ({
    id: game.id,
    title: game.title,
    sortTitle: game.sortTitle,
    platform: game.platform,
    pursuitStatus: createCompatiblePursuitStatus(game.playStatus),
    priorityRank: game.priorityRank,
    notes: game.notes,
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
    archivedAt: game.hiddenAt,
  }));
}

test("exports, previews, backs up, and atomically replaces portable backlog data", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-portable-test-"),
  );

  const source = openDatabase(join(temporaryDirectory, "source.sqlite"));

  const target = openDatabase(join(temporaryDirectory, "target.sqlite"));

  try {
    const sourceGames = new LibraryGameRepository(source);

    const sourceCollections = new CollectionRepository(source);

    const firstGame = sourceGames.create({
      title: "Astro Bot",
      platform: "PS5",
      playStatus: "completed",
      isUnobtainable: true,
    });

    const secondGame = sourceGames.create({
      title: "Bloodborne",
      platform: "PS4",
    });

    sourceGames.hide(secondGame.id);

    const collection = sourceCollections.create({
      name: "Favorites",
      description: "Keep these.",
    });

    sourceCollections.replaceGames(collection.id, [
      secondGame.id,
      firstGame.id,
    ]);

    const sourceResources = new GameResourceRepository(source);

    sourceResources.create(firstGame.id, {
      resourceType: "trophy_page",
      url: "https://psnprofiles.com/trophies/12345-astro-bot",
    });

    sourceResources.create(firstGame.id, {
      resourceType: "guide",
      url: "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
      label: "PowerPyx guide",
    });

    const sourceViews = new SavedViewRepository(source);

    sourceViews.create({
      name: "PS5 favorites",

      filters: {
        platforms: ["PS5"],
        collectionIds: [collection.id],
      },

      sort: {
        field: "title",
        direction: "asc",
      },
    });

    const targetGames = new LibraryGameRepository(target);

    targetGames.create({
      title: "Replace me",
      platform: "PS3",
    });

    const portableData = parsePortableDataExport(
      createPortableDataExport(source),
    );

    const preview = previewPortableImport(target, portableData);

    assert.deepEqual(preview.incoming, {
      libraryGames: 2,
      collections: 1,
      memberships: 2,
      savedViews: 9,
      playstationLinks: 0,
      metadataEntries: 0,
      trophySnapshots: 0,
      trophyAlerts: 0,
      cachedImages: 0,
      gameResources: 2,
    });

    assert.deepEqual(preview.current, {
      libraryGames: 1,
      collections: 0,
      memberships: 0,
      savedViews: 8,
      playstationLinks: 0,
      metadataEntries: 0,
      trophySnapshots: 0,
      trophyAlerts: 0,
      cachedImages: 0,
      gameResources: 0,
    });

    const backupDirectory = join(temporaryDirectory, "backups");

    const result = await importPortableData(
      target,
      backupDirectory,
      portableData,
    );

    assert.equal(
      existsSync(join(backupDirectory, result.backup.fileName)),
      true,
    );

    assert.deepEqual(createPortableDataExport(target).data, portableData.data);
  } finally {
    source.close();
    target.close();

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("refuses an older import that cannot preserve integration data", () => {
  const database = openDatabase(":memory:");

  const games = new LibraryGameRepository(database);

  try {
    const game = games.create({
      title: "Returnal",
      platform: "PS5",
    });

    database
      .prepare(
        `
          INSERT INTO external_game_metadata (
            id,
            provider,
            external_id,
            title,
            payload_json,
            fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "metadata",
        "test",
        "external",
        "Returnal",
        "{}",
        new Date().toISOString(),
      );

    database
      .prepare(
        `
          INSERT INTO game_metadata_links (
            game_id,
            metadata_id,
            linked_at
          ) VALUES (?, ?, ?)
        `,
      )
      .run(game.id, "metadata", new Date().toISOString());

    const versionFour = createPortableDataExport(database);

    const portableData = {
      format: versionFour.format,
      formatVersion: 2 as const,
      exportedAt: versionFour.exportedAt,

      data: {
        libraryGames: createLegacyPortableLibraryGames(
          versionFour.data.libraryGames,
        ),
        collections: versionFour.data.collections,
        savedViews: versionFour.data.savedViews,
      },
    };

    assert.throws(
      () => previewPortableImport(database, portableData),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          "cannot preserve existing PlayStation, metadata, trophy, alert, or image-cache records",
        ),
    );
  } finally {
    database.close();
  }
});

test("refuses a version-one import that would break Collection saved views", () => {
  const database = openDatabase(":memory:");

  try {
    const collections = new CollectionRepository(database);

    const views = new SavedViewRepository(database);

    const collection = collections.create({
      name: "Favorites",
    });

    views.create({
      name: "Favorite games",

      filters: {
        collectionIds: [collection.id],
      },

      sort: {
        field: "priorityRank",
        direction: "asc",
      },
    });

    const versionTwo = createPortableDataExport(database);

    const versionOne = {
      format: versionTwo.format,
      formatVersion: 1 as const,
      exportedAt: versionTwo.exportedAt,

      data: {
        libraryGames: createLegacyPortableLibraryGames(
          versionTwo.data.libraryGames,
        ),
        collections: versionTwo.data.collections,
      },
    };

    assert.throws(
      () => previewPortableImport(database, versionOne),

      (error: unknown) =>
        error instanceof HttpError &&
        error.code === "portable_v1_cannot_preserve_collection_views",
    );
  } finally {
    database.close();
  }
});
