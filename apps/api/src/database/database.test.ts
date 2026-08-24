import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { createDatabaseBackup } from "../features/backups/createDatabaseBackup.js";
import { openDatabase } from "./database.js";
import { getDatabaseStatus } from "./getDatabaseStatus.js";
import { runMigrations } from "./runMigrations.js";

interface CountRow {
  count: number;
}

test("opens the database, applies the initial migration, and seeds built-in views", () => {
  const database = openDatabase(":memory:");

  try {
    assert.deepEqual(getDatabaseStatus(database), {
      ok: true,
      schemaVersion: 1,
      availableMigrationCount: 1,
    });

    const row = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM saved_views
          WHERE is_builtin = 1
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(row.count, 7);
  } finally {
    database.close();
  }
});

test("enforces platform and trophy-count constraints", () => {
  const database = openDatabase(":memory:");
  const timestamp = new Date().toISOString();

  try {
    assert.throws(() => {
      database
        .prepare(
          `
            INSERT INTO library_games (
              id,
              title,
              sort_title,
              platform,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          "bad-platform",
          "Example",
          "Example",
          "Vita",
          timestamp,
          timestamp,
        );
    });

    database
      .prepare(
        `
          INSERT INTO library_games (
            id,
            title,
            sort_title,
            platform,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run("valid-game", "Example", "Example", "PS5", timestamp, timestamp);

    assert.throws(() => {
      database
        .prepare(
          `
            INSERT INTO trophy_snapshots (
              id,
              game_id,
              captured_at,
              bronze_total,
              silver_total,
              gold_total,
              platinum_total,
              bronze_earned,
              silver_earned,
              gold_earned,
              platinum_earned,
              progress_percent,
              is_100_percent,
              has_platinum
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          "invalid-snapshot",
          "valid-game",
          timestamp,
          10,
          0,
          0,
          0,
          11,
          0,
          0,
          0,
          50,
          0,
          0,
        );
    });
  } finally {
    database.close();
  }
});

test("rejects edits to a migration that has already been applied", () => {
  const database = new DatabaseSync(":memory:");

  try {
    runMigrations(database, [
      {
        version: 1,
        name: "test_migration",
        sql: `
            CREATE TABLE example (
              id INTEGER PRIMARY KEY
            ) STRICT;
          `,
      },
    ]);

    assert.throws(() => {
      runMigrations(database, [
        {
          version: 1,
          name: "test_migration",
          sql: `
                CREATE TABLE changed_example (
                  id INTEGER PRIMARY KEY
                ) STRICT;
              `,
        },
      ]);
    }, /has changed after being applied/);
  } finally {
    database.close();
  }
});

test("creates a restorable SQLite backup", async () => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "trophy-backlog-test-"),
  );

  const sourcePath = join(temporaryDirectory, "source.sqlite");

  const backupDirectory = join(temporaryDirectory, "backups");

  const database = openDatabase(sourcePath);

  try {
    const result = await createDatabaseBackup(database, backupDirectory);

    const backupPath = join(backupDirectory, result.fileName);

    assert.equal(existsSync(backupPath), true);

    const restoredDatabase = new DatabaseSync(backupPath, {
      readOnly: true,
    });

    try {
      const row = restoredDatabase
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM schema_migrations
          `,
        )
        .get() as unknown as CountRow;

      assert.equal(row.count, 1);
    } finally {
      restoredDatabase.close();
    }
  } finally {
    database.close();

    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
