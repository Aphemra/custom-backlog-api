import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { PlayStationProfileProgressionService } from "./playStationProfileProgressionService.js";

test("reads the latest profile snapshot and calculates point progression", () => {
  const database = openDatabase(":memory:");
  const service = new PlayStationProfileProgressionService(database);

  try {
    assert.equal(service.findLatest(), null);

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
        "profile-run",
        "target-account",
        "succeeded",
        "2026-08-27T12:00:00.000Z",
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
        "profile-snapshot",
        "profile-run",
        "target-account",
        "2026-08-27T12:01:00.000Z",
        396,
        41,
        4,
        3_367,
        1_147,
        380,
        92,
        "{}",
      );

    assert.deepEqual(service.findLatest(), {
      accountId: "target-account",
      capturedAt: "2026-08-27T12:01:00.000Z",
      server: {
        level: 396,
        progressPercent: 41,
        tier: 4,
      },
      earnedTrophies: {
        bronze: 3_367,
        silver: 1_147,
        gold: 380,
        platinum: 92,
      },
      points: {
        total: 146_715,
        inCurrentLevel: 375,
        forCurrentLevel: 900,
        toNextLevel: 525,
        toLevel999: 1_484_625,
      },
      calculation: {
        level: 396,
        progressPercent: 41,
        levelMatchesServer: true,
        progressMatchesServer: true,
      },
    });
  } finally {
    database.close();
  }
});
