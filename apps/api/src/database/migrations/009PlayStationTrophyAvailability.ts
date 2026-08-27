import type { Migration } from "../migration.js";

export const playStationTrophyAvailabilityMigration: Migration = {
  version: 9,
  name: "playstation_trophy_availability",
  sql: `
    CREATE TABLE playstation_trophy_availability_overrides (
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      trophy_id INTEGER NOT NULL
        CHECK (trophy_id >= 0),
      reason TEXT
        CHECK (
          reason IS NULL
          OR length(trim(reason)) BETWEEN 1 AND 500
        ),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_id)
    ) STRICT;

    CREATE INDEX playstation_trophy_availability_game_index
      ON playstation_trophy_availability_overrides (
        game_id,
        trophy_id
      );
  `,
};
