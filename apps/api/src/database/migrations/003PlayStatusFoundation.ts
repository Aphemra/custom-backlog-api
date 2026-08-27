import type { Migration } from "../migration.js";

export const playStatusFoundationMigration: Migration = {
  version: 3,
  name: "play_status_foundation",
  sql: `
    ALTER TABLE library_games
      ADD COLUMN play_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (play_status IN (
          'unreleased',
          'not_started',
          'playing',
          'on_hold',
          'waiting',
          'completed'
        ));

    ALTER TABLE library_games
      ADD COLUMN is_unobtainable INTEGER NOT NULL DEFAULT 0
        CHECK (is_unobtainable IN (0, 1));

    UPDATE library_games
    SET play_status = CASE pursuit_status
      WHEN 'unplanned' THEN 'not_started'
      WHEN 'pursuing_soon' THEN 'not_started'
      WHEN 'in_progress' THEN 'playing'
      WHEN 'paused' THEN 'on_hold'
      WHEN 'finished' THEN 'completed'
      WHEN 'abandoned' THEN 'on_hold'
      ELSE 'not_started'
    END;

    CREATE INDEX library_games_play_status_index
      ON library_games (
        archived_at,
        play_status,
        is_unobtainable,
        priority_rank,
        sort_title
      );
  `,
};
