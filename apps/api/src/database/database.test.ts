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
import { runMigrations } from "./runMigrations.js";

interface CountRow {
  count: number;
}

test("opens the database, applies all migrations, and seeds built-in views", () => {
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

    assert.equal(row.count, 8);
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

test("stores ordered game resources with constrained provider combinations", () => {
  const database = openDatabase(":memory:");
  const timestamp = "2026-08-28T12:00:00.000Z";

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
      .run(
        "resource-game",
        "Astro Bot",
        "astro bot",
        "PS5",
        timestamp,
        timestamp,
      );

    const insertResource = database.prepare(`
      INSERT INTO game_resources (
        id,
        game_id,
        resource_type,
        provider,
        url,
        label,
        sort_order,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertResource.run(
      "trophy-page",
      "resource-game",
      "trophy_page",
      "psnprofiles",
      "https://psnprofiles.com/trophies/12345-astro-bot",
      null,
      1_000,
      timestamp,
      timestamp,
    );

    insertResource.run(
      "powerpyx-guide",
      "resource-game",
      "guide",
      "powerpyx",
      "https://www.powerpyx.com/astro-bot-trophy-guide-roadmap/",
      "Trophy guide",
      2_000,
      timestamp,
      timestamp,
    );

    insertResource.run(
      "mapgenie-map",
      "resource-game",
      "interactive_map",
      "mapgenie",
      "https://mapgenie.io/astro-bot/maps/example",
      "Interactive map",
      3_000,
      timestamp,
      timestamp,
    );

    assert.throws(() => {
      insertResource.run(
        "duplicate-trophy-page",
        "resource-game",
        "trophy_page",
        "psnprofiles",
        "https://psnprofiles.com/trophies/67890-astro-bot",
        null,
        4_000,
        timestamp,
        timestamp,
      );
    });

    assert.throws(() => {
      insertResource.run(
        "invalid-guide-provider",
        "resource-game",
        "guide",
        "mapgenie",
        "https://mapgenie.io/astro-bot/guides/example",
        null,
        4_000,
        timestamp,
        timestamp,
      );
    });

    assert.throws(() => {
      insertResource.run(
        "unsafe-resource",
        "resource-game",
        "guide",
        "other",
        "http://example.com/unsafe-guide",
        null,
        4_000,
        timestamp,
        timestamp,
      );
    });

    const storedCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM game_resources
          WHERE game_id = ?
        `,
      )
      .get("resource-game") as unknown as CountRow;

    assert.equal(storedCount.count, 3);

    database
      .prepare("DELETE FROM library_games WHERE id = ?")
      .run("resource-game");

    const remainingCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM game_resources
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(remainingCount.count, 0);
  } finally {
    database.close();
  }
});

test("stores constrained PlayStation profile snapshots", () => {
  const database = openDatabase(":memory:");
  const timestamp = "2026-08-27T12:00:00.000Z";

  try {
    database
      .prepare(
        `
          INSERT INTO trophy_sync_runs (
            id,
            target_account_id,
            status,
            request_count,
            started_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run("profile-sync-run", "20002", "succeeded", 5, timestamp);

    assert.throws(() => {
      database
        .prepare(
          `
            INSERT INTO playstation_profile_snapshots (
              id,
              sync_run_id,
              account_id,
              captured_at,
              trophy_level,
              level_progress_percent,
              tier,
              bronze_earned,
              silver_earned,
              gold_earned,
              platinum_earned,
              payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          "invalid-profile-snapshot",
          "profile-sync-run",
          "20002",
          timestamp,
          425,
          101,
          5,
          1_234,
          456,
          78,
          42,
          JSON.stringify({ trophyLevel: 425 }),
        );
    });

    database
      .prepare(
        `
          INSERT INTO playstation_profile_snapshots (
            id,
            sync_run_id,
            account_id,
            captured_at,
            trophy_level,
            level_progress_percent,
            tier,
            bronze_earned,
            silver_earned,
            gold_earned,
            platinum_earned,
            payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "valid-profile-snapshot",
        "profile-sync-run",
        "20002",
        timestamp,
        425,
        52,
        5,
        1_234,
        456,
        78,
        42,
        JSON.stringify({
          trophyLevel: 425,
          progress: 52,
          tier: 5,
          earnedTrophies: {
            bronze: 1_234,
            silver: 456,
            gold: 78,
            platinum: 42,
          },
        }),
      );

    const storedCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playstation_profile_snapshots
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(storedCount.count, 1);

    database
      .prepare(
        `
          DELETE FROM trophy_sync_runs
          WHERE id = ?
        `,
      )
      .run("profile-sync-run");

    const remainingCount = database
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM playstation_profile_snapshots
        `,
      )
      .get() as unknown as CountRow;

    assert.equal(remainingCount.count, 0);
  } finally {
    database.close();
  }
});

test("stores constrained normalized PlayStation trophy data", () => {
  const database = openDatabase(":memory:");
  const timestamp = "2026-08-27T12:00:00.000Z";

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
      .run(
        "normalized-trophy-game",
        "Example Trophy Game",
        "Example Trophy Game",
        "PS5",
        timestamp,
        timestamp,
      );

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
        "normalized-trophy-game",
        "NPWR99999_00",
        "trophy2",
        "Example Trophy Game",
        JSON.stringify(["PS5"]),
        "https://example.com/title.png",
        "manual_match",
        JSON.stringify({ npCommunicationId: "NPWR99999_00" }),
        timestamp,
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          INSERT INTO playstation_trophy_sets (
            game_id,
            np_communication_id,
            np_service_name,
            trophy_set_version,
            title_name,
            platforms_json,
            icon_url,
            has_trophy_groups,
            definitions_refreshed_at,
            definition_payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "normalized-trophy-game",
        "NPWR99999_00",
        "trophy2",
        "01.00",
        "Example Trophy Game",
        JSON.stringify(["PS5"]),
        "https://example.com/title.png",
        0,
        timestamp,
        JSON.stringify({ trophySetVersion: "01.00" }),
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          INSERT INTO playstation_trophy_groups (
            game_id,
            trophy_group_id,
            name,
            icon_url,
            bronze_total,
            silver_total,
            gold_total,
            platinum_total,
            payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "normalized-trophy-game",
        "default",
        "Example Trophy Game",
        "https://example.com/group.png",
        1,
        0,
        0,
        0,
        JSON.stringify({ trophyGroupId: "default" }),
        timestamp,
        timestamp,
      );

    assert.throws(() => {
      database
        .prepare(
          `
            INSERT INTO playstation_trophies (
              game_id,
              trophy_id,
              trophy_group_id,
              trophy_type,
              name,
              is_secret,
              rarity,
              definition_payload_json,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          "normalized-trophy-game",
          0,
          "default",
          "bronze",
          "Invalid rarity",
          0,
          4,
          JSON.stringify({ trophyId: 0 }),
          timestamp,
          timestamp,
        );
    });

    database
      .prepare(
        `
          INSERT INTO playstation_trophies (
            game_id,
            trophy_id,
            trophy_group_id,
            trophy_type,
            name,
            detail,
            icon_url,
            is_secret,
            is_earned,
            earned_at,
            rarity,
            earned_rate,
            progress_target_value,
            progress_value,
            progress_rate,
            definition_payload_json,
            earnings_payload_json,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "normalized-trophy-game",
        0,
        "default",
        "bronze",
        "First Trophy",
        "Earn the first trophy.",
        "https://example.com/trophy.png",
        0,
        1,
        timestamp,
        0,
        2.5,
        "100",
        "100",
        100,
        JSON.stringify({
          trophyId: 0,
          trophyGroupId: "default",
          trophyType: "bronze",
        }),
        JSON.stringify({
          trophyId: 0,
          earned: true,
          earnedDateTime: timestamp,
        }),
        timestamp,
        timestamp,
      );

    database
      .prepare(
        `
          DELETE FROM playstation_game_links
          WHERE game_id = ?
        `,
      )
      .run("normalized-trophy-game");

    for (const tableName of [
      "playstation_trophy_sets",
      "playstation_trophy_groups",
      "playstation_trophies",
    ]) {
      const row = database
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM ${tableName}
          `,
        )
        .get() as unknown as CountRow;

      assert.equal(row.count, 0, tableName);
    }
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
