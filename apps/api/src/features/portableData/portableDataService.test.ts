import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
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
      pursuitStatus: "finished",
    });

    const secondGame = sourceGames.create({
      title: "Bloodborne",
      platform: "PS4",
    });

    sourceGames.archive(secondGame.id);

    const collection = sourceCollections.create({
      name: "Favorites",
      description: "Keep these.",
    });

    sourceCollections.replaceGames(collection.id, [
      secondGame.id,
      firstGame.id,
    ]);

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
    });

    assert.deepEqual(preview.current, {
      libraryGames: 1,
      collections: 0,
      memberships: 0,
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

test("refuses to replace data that portable version one cannot preserve", () => {
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

    const portableData = createPortableDataExport(database);

    assert.throws(
      () => previewPortableImport(database, portableData),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes(
          "cannot preserve existing metadata or trophy history",
        ),
    );
  } finally {
    database.close();
  }
});
