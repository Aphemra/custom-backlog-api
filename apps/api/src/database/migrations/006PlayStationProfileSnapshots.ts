import type { Migration } from "../migration.js";

export const playStationProfileSnapshotsMigration: Migration = {
  version: 6,
  name: "playstation_profile_snapshots",
  sql: `
    CREATE TABLE playstation_profile_snapshots (
      id TEXT PRIMARY KEY,
      sync_run_id TEXT NOT NULL UNIQUE
        REFERENCES trophy_sync_runs(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL
        CHECK (length(trim(account_id)) > 0),
      captured_at TEXT NOT NULL,
      trophy_level INTEGER NOT NULL
        CHECK (trophy_level >= 0),
      level_progress_percent INTEGER NOT NULL
        CHECK (level_progress_percent BETWEEN 0 AND 100),
      tier INTEGER NOT NULL
        CHECK (tier BETWEEN 1 AND 10),
      bronze_earned INTEGER NOT NULL
        CHECK (bronze_earned >= 0),
      silver_earned INTEGER NOT NULL
        CHECK (silver_earned >= 0),
      gold_earned INTEGER NOT NULL
        CHECK (gold_earned >= 0),
      platinum_earned INTEGER NOT NULL
        CHECK (platinum_earned >= 0),
      payload_json TEXT NOT NULL
        CHECK (json_valid(payload_json))
    ) STRICT;

    CREATE INDEX playstation_profile_snapshots_account_index
      ON playstation_profile_snapshots (
        account_id,
        captured_at DESC
      );
  `,
};
