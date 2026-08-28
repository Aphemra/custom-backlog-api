import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { CollectionRepository } from "../collections/collectionRepository.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { SavedViewRepository } from "../savedViews/savedViewRepository.js";
import {
  deleteEntireBacklog,
  deleteEntireBacklogConfirmation,
} from "./backlogMaintenanceService.js";

function readCount(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get() as unknown as {
    readonly count: number;
  };

  return row.count;
}

test("backs up and deletes the entire backlog only after exact confirmation", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-maintenance-test-"),
  );

  const backupDirectory = join(temporaryDirectory, "backups");

  const database = openDatabase(join(temporaryDirectory, "database.sqlite"));

  try {
    const games = new LibraryGameRepository(database);
    const collections = new CollectionRepository(database);
    const savedViews = new SavedViewRepository(database);

    const firstGame = games.create({
      title: "Astro Bot",
      platform: "PS5",
    });

    games.create({
      title: "Returnal",
      platform: "PS5",
    });

    const collection = collections.create({
      name: "Favorites",
    });

    collections.replaceGames(collection.id, [firstGame.id]);

    savedViews.create({
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
        "preserved-igdb-metadata",
        "igdb",
        "12345",
        "Astro Bot",
        "{}",
        new Date().toISOString(),
      );

    await assert.rejects(
      deleteEntireBacklog(database, backupDirectory, {
        confirmation: "delete entire backlog",
      }),
      (error: unknown) => {
        assert.equal(error instanceof HttpError, true);

        if (error instanceof HttpError) {
          assert.equal(error.code, "invalid_backlog_deletion_confirmation");
        }

        return true;
      },
    );

    assert.equal(
      readCount(database, "SELECT COUNT(*) AS count FROM library_games"),
      2,
    );

    const result = await deleteEntireBacklog(database, backupDirectory, {
      confirmation: deleteEntireBacklogConfirmation,
    });

    assert.deepEqual(result.deleted, {
      libraryGames: 2,
      collections: 1,
      savedViews: 1,
    });

    assert.equal(
      existsSync(join(backupDirectory, result.backup.fileName)),
      true,
    );

    assert.equal(
      readCount(database, "SELECT COUNT(*) AS count FROM library_games"),
      0,
    );

    assert.equal(
      readCount(database, "SELECT COUNT(*) AS count FROM collections"),
      0,
    );

    assert.equal(
      readCount(
        database,
        `
        SELECT COUNT(*) AS count
        FROM saved_views
        WHERE is_builtin = 0
      `,
      ),
      0,
    );

    assert.equal(
      readCount(
        database,
        `
        SELECT COUNT(*) AS count
        FROM saved_views
        WHERE is_builtin = 1
      `,
      ) > 0,
      true,
    );

    assert.equal(
      readCount(
        database,
        "SELECT COUNT(*) AS count FROM external_game_metadata",
      ),
      1,
    );
  } finally {
    database.close();

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
