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
import { initialSchemaMigration } from "./migrations/001InitialSchema.js";
import { integrationStorageMigration } from "./migrations/002IntegrationStorage.js";
import { playStatusFoundationMigration } from "./migrations/003PlayStatusFoundation.js";
import { runMigrations } from "./runMigrations.js";

interface CountRow {
  count: number;
}

test("opens the database, applies all migrations, and seeds built-in views", () => {
  const database = openDatabase(":memory:");

  try {
    assert.deepEqual(getDatabaseStatus(database), {
      ok: true,
      schemaVersion: 5,
      availableMigrationCount: 5,
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

test("upgrades an existing version-one database without replacing it", () => {
  const database = new DatabaseSync(":memory:");

  try {
    runMigrations(database, [initialSchemaMigration]);

    assert.deepEqual(getDatabaseStatus(database), {
      ok: true,
      schemaVersion: 1,
      availableMigrationCount: 5,
    });

    runMigrations(database);

    assert.deepEqual(getDatabaseStatus(database), {
      ok: true,
      schemaVersion: 5,
      availableMigrationCount: 5,
    });

    const row = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM sqlite_schema
          WHERE type = 'table'
            AND name IN (
              'playstation_game_links',
              'cached_images',
              'library_game_images'
            )
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(row.count, 3);
  } finally {
    database.close();
  }
});

test("migrates legacy pursuit statuses into the play-status model", () => {
  const database = new DatabaseSync(":memory:");
  const timestamp = new Date().toISOString();

  try {
    runMigrations(database, [
      initialSchemaMigration,
      integrationStorageMigration,
    ]);

    const insertGame = database.prepare(`
      INSERT INTO library_games (
        id,
        title,
        sort_title,
        platform,
        pursuit_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'PS5', ?, ?, ?)
    `);

    const legacyStatuses = [
      ["unplanned-game", "unplanned"],
      ["pursuing-soon-game", "pursuing_soon"],
      ["in-progress-game", "in_progress"],
      ["paused-game", "paused"],
      ["finished-game", "finished"],
      ["abandoned-game", "abandoned"],
    ] as const;

    for (const [id, pursuitStatus] of legacyStatuses) {
      insertGame.run(id, id, id, pursuitStatus, timestamp, timestamp);
    }

    runMigrations(database);

    const rows = database
      .prepare(
        `
          SELECT
            id,
            play_status,
            is_unobtainable
          FROM library_games
          ORDER BY id ASC
        `,
      )
      .all() as unknown as Array<{
      id: string;
      play_status: string;
      is_unobtainable: number;
    }>;

    assert.deepEqual(
      rows.map((row) => ({ ...row })),
      [
        {
          id: "abandoned-game",
          play_status: "on_hold",
          is_unobtainable: 0,
        },
        {
          id: "finished-game",
          play_status: "completed",
          is_unobtainable: 0,
        },
        {
          id: "in-progress-game",
          play_status: "playing",
          is_unobtainable: 0,
        },
        {
          id: "paused-game",
          play_status: "on_hold",
          is_unobtainable: 0,
        },
        {
          id: "pursuing-soon-game",
          play_status: "not_started",
          is_unobtainable: 0,
        },
        {
          id: "unplanned-game",
          play_status: "not_started",
          is_unobtainable: 0,
        },
      ],
    );

    assert.throws(() => {
      database
        .prepare(
          `
            UPDATE library_games
            SET play_status = 'abandoned'
            WHERE id = 'abandoned-game'
          `,
        )
        .run();
    });

    assert.throws(() => {
      database
        .prepare(
          `
            UPDATE library_games
            SET is_unobtainable = 2
            WHERE id = 'abandoned-game'
          `,
        )
        .run();
    });
  } finally {
    database.close();
  }
});

test("migrates saved views to Play Status and Hidden Games filters", () => {
  const database = new DatabaseSync(":memory:");
  const timestamp = new Date().toISOString();

  try {
    runMigrations(database, [
      initialSchemaMigration,
      integrationStorageMigration,
      playStatusFoundationMigration,
    ]);

    database
      .prepare(
        `
          INSERT INTO saved_views (
            id,
            builtin_key,
            name,
            filters_json,
            sort_json,
            sort_order,
            is_builtin,
            created_at,
            updated_at
          ) VALUES (?, NULL, ?, ?, ?, ?, 0, ?, ?)
        `,
      )
      .run(
        "legacy-custom-view",
        "Legacy custom view",
        JSON.stringify({
          pursuitStatuses: ["unplanned", "pursuing_soon", "in_progress"],
          archiveMode: "archived",
        }),
        JSON.stringify({
          field: "pursuitStatus",
          direction: "asc",
        }),
        100,
        timestamp,
        timestamp,
      );

    runMigrations(database);

    const row = database
      .prepare(
        `
          SELECT filters_json, sort_json
          FROM saved_views
          WHERE id = 'legacy-custom-view'
        `,
      )
      .get() as unknown as {
      filters_json: string;
      sort_json: string;
    };

    const filters = JSON.parse(row.filters_json) as {
      playStatuses: string[];
      hiddenMode: string;
    };

    const sort = JSON.parse(row.sort_json) as {
      field: string;
      direction: string;
    };

    assert.deepEqual(
      new Set(filters.playStatuses),
      new Set(["not_started", "playing"]),
    );

    assert.equal(filters.hiddenMode, "hidden");

    assert.deepEqual(sort, {
      field: "playStatus",
      direction: "asc",
    });
  } finally {
    database.close();
  }
});

test("stores PlayStation identity and local image-cache metadata", () => {
  const database = openDatabase(":memory:");
  const timestamp = new Date().toISOString();

  try {
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
      .run("astro-bot", "Astro Bot", "astro bot", "PS5", timestamp, timestamp);

    database
      .prepare(
        `
          INSERT INTO playstation_game_links (
            game_id,
            np_communication_id,
            np_service_name,
            psn_title_name,
            platforms_json,
            icon_url,
            link_source,
            payload_json,
            linked_at,
            first_seen_at,
            last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "astro-bot",
        "NPWR00001_00",
        "trophy2",
        "Astro Bot",
        JSON.stringify(["PS5"]),
        "https://example.test/astro-bot.png",
        "sync_created",
        JSON.stringify({ trophyTitleId: "NPWR00001_00" }),
        timestamp,
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          INSERT INTO cached_images (
            id,
            provider,
            source_key,
            source_url,
            file_name,
            content_type,
            byte_size,
            fetched_at,
            last_checked_at,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "astro-icon",
        "playstation",
        "NPWR00001_00:icon",
        "https://example.test/astro-bot.png",
        "astro-icon.png",
        "image/png",
        1_024,
        timestamp,
        timestamp,
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          INSERT INTO library_game_images (
            game_id,
            image_id,
            role,
            sort_order,
            linked_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run("astro-bot", "astro-icon", "icon", 0, timestamp);

    assert.throws(() => {
      database
        .prepare(
          `
            INSERT INTO cached_images (
              id,
              provider,
              source_key,
              source_url,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          "unsupported-image",
          "unknown-provider",
          "image",
          "https://example.test/image.png",
          timestamp,
          timestamp,
        );
    });

    database.prepare("DELETE FROM library_games WHERE id = ?").run("astro-bot");

    const linkCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playstation_game_links
        `,
      )
      .get() as unknown as CountRow;

    const imageLinkCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM library_game_images
        `,
      )
      .get() as unknown as CountRow;

    const cachedImageCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM cached_images
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(linkCount.count, 0);
    assert.equal(imageLinkCount.count, 0);
    assert.equal(cachedImageCount.count, 1);
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

      assert.equal(row.count, 5);
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
