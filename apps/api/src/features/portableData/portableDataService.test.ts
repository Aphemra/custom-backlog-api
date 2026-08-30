import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { GameResourceRepository } from "../resources/gameResourceRepository.js";
import { SavedViewRepository } from "../savedViews/savedViewRepository.js";
import {
  createPortableDataExport,
  importPortableData,
  previewPortableImport,
} from "./portableDataService.js";
import { parsePortableDataExport } from "./portableDataValidation.js";

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
