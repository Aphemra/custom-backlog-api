import assert from "node:assert/strict";
import type { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { TrophyHistoryRepository } from "./trophyHistoryRepository.js";

const TIMESTAMP = "2026-08-27T12:00:00.000Z";

function seedProfileSnapshot(database: DatabaseSync): void {
  database
    .prepare(
      `
        INSERT INTO trophy_sync_runs (
          id,
          target_account_id,
          status,
          started_at,
          finished_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      "history-sync-run",
      "target-account",
      "succeeded",
      TIMESTAMP,
      "2026-08-27T12:01:00.000Z",
    );

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
      "history-profile-snapshot",
      "history-sync-run",
      "target-account",
      "2026-08-27T12:01:00.000Z",
      2,
      25,
      1,
      2,
      0,
      0,
      1,
      "{}",
    );
}

function seedEarnedTrophies(database: DatabaseSync): string {
  const game = new LibraryGameRepository(database).create({
    title: "History Game",
    platform: "PS5",
    playStatus: "completed",
    notes: null,
  });

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
      game.id,
      "NPWR99999_00",
      "trophy2",
      "History Game",
      JSON.stringify(["PS5"]),
      "https://example.com/history-game.png",
      "manual_match",
      "{}",
      TIMESTAMP,
      TIMESTAMP,
      TIMESTAMP,
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
          bronze_total,
          silver_total,
          gold_total,
          platinum_total,
          definitions_refreshed_at,
          earnings_refreshed_at,
          definition_payload_json,
          earnings_payload_json,
          created_at,
          updated_at,
          earnings_account_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
    )
    .run(
      game.id,
      "NPWR99999_00",
      "trophy2",
      "01.00",
      "History Game",
      JSON.stringify(["PS5"]),
      "https://example.com/history-game.png",
      0,
      1,
      0,
      0,
      1,
      TIMESTAMP,
      TIMESTAMP,
      "{}",
      "{}",
      TIMESTAMP,
      TIMESTAMP,
      "target-account",
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
      game.id,
      "default",
      "History Game",
      "https://example.com/history-game.png",
      1,
      0,
      0,
      1,
      "{}",
      TIMESTAMP,
      TIMESTAMP,
    );

  const insertTrophy = database.prepare(`
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
      definition_payload_json,
      earnings_payload_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTrophy.run(
    game.id,
    0,
    "default",
    "bronze",
    "The Beginning",
    "Earn the first trophy.",
    "https://example.com/bronze.png",
    0,
    1,
    "2020-01-01T00:00:00.000Z",
    "{}",
    "{}",
    TIMESTAMP,
    TIMESTAMP,
  );

  insertTrophy.run(
    game.id,
    1,
    "default",
    "platinum",
    "History Complete",
    "Earn every other trophy.",
    "https://example.com/platinum.png",
    0,
    1,
    null,
    "{}",
    "{}",
    TIMESTAMP,
    TIMESTAMP,
  );

  return game.id;
}

test("reports an unverifiable empty timeline before a profile sync", () => {
  const database = openDatabase(":memory:");

  try {
    const result = new TrophyHistoryRepository(database).find();

    assert.deepEqual(result.timeline.entries, []);
    assert.deepEqual(result.timeline.milestones, []);
    assert.equal(result.coverage.latestProfileSnapshot, null);
    assert.equal(result.coverage.missingFromLocalCache, null);
    assert.equal(result.coverage.missingFromTimeline, null);
    assert.equal(result.coverage.excessInLocalCache, null);
    assert.equal(result.coverage.isComplete, null);
  } finally {
    database.close();
  }
});

test("reconstructs timestamped trophies and exposes known coverage gaps", () => {
  const database = openDatabase(":memory:");

  try {
    seedProfileSnapshot(database);
    const gameId = seedEarnedTrophies(database);

    const result = new TrophyHistoryRepository(database).find();

    assert.deepEqual(result.coverage.latestProfileSnapshot, {
      accountId: "target-account",
      capturedAt: "2026-08-27T12:01:00.000Z",
      earnedTrophies: {
        bronze: 2,
        silver: 0,
        gold: 0,
        platinum: 1,
      },
    });

    assert.deepEqual(result.coverage.locallyStoredEarnedTrophies, {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 1,
    });

    assert.deepEqual(result.coverage.timestampedEarnedTrophies, {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    });

    assert.deepEqual(result.coverage.missingEarnedTrophyTimestamps, {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 1,
    });

    assert.deepEqual(result.coverage.missingFromLocalCache, {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 0,
    });

    assert.deepEqual(result.coverage.missingFromTimeline, {
      bronze: 1,
      silver: 0,
      gold: 0,
      platinum: 1,
    });

    assert.deepEqual(result.coverage.excessInLocalCache, {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    });

    assert.equal(result.coverage.isComplete, false);
    assert.equal(result.timeline.entries.length, 1);
    assert.equal(result.timeline.entries[0]?.gameId, gameId);
    assert.equal(result.timeline.entries[0]?.trophyName, "The Beginning");
    assert.equal(
      result.timeline.entries[0]?.earnedAt,
      "2020-01-01T00:00:00.000Z",
    );

    assert.deepEqual(result.timeline.summary, {
      oldestEarnedAt: "2020-01-01T00:00:00.000Z",
      newestEarnedAt: "2020-01-01T00:00:00.000Z",
      earnedTrophies: {
        bronze: 1,
        silver: 0,
        gold: 0,
        platinum: 0,
      },
      earnedTrophyCount: 1,
      totalPoints: 15,
      calculatedLevel: 1,
      calculatedLevelProgressPercent: 25,
    });
  } finally {
    database.close();
  }
});
