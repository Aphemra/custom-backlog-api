import type { Migration } from "../migration.js";

export const backlogHistoryMigration: Migration = {
  version: 17,
  name: "backlog_history",
  sql: `
    CREATE TABLE backlog_history_entries (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL
        CHECK (
          action IN (
            'game_added',
            'game_hidden',
            'game_unhidden',
            'game_deleted',
            'play_status_changed',
            'game_platform_changed',
            'library_reordered',
            'trophy_marked_unobtainable',
            'trophy_restored',
            'collection_created',
            'collection_updated',
            'collection_deleted',
            'collection_pinned',
            'collection_unpinned',
            'collection_membership_changed',
            'collection_reordered',
            'collection_games_reordered',
            'backlog_imported',
            'backlog_deleted'
          )
        ),
      source TEXT NOT NULL
        CHECK (
          source IN (
            'user',
            'playstation_sync',
            'portable_import',
            'system'
          )
        ),
      occurred_at TEXT NOT NULL,
      game_id TEXT
        CHECK (
          game_id IS NULL
          OR (
            game_id = trim(game_id)
            AND length(game_id) BETWEEN 1 AND 200
          )
        ),
      game_title TEXT
        CHECK (
          game_title IS NULL
          OR (
            game_title = trim(game_title)
            AND length(game_title) BETWEEN 1 AND 300
          )
        ),
      collection_id TEXT
        CHECK (
          collection_id IS NULL
          OR (
            collection_id = trim(collection_id)
            AND length(collection_id) BETWEEN 1 AND 200
          )
        ),
      collection_name TEXT
        CHECK (
          collection_name IS NULL
          OR (
            collection_name = trim(collection_name)
            AND length(collection_name) BETWEEN 1 AND 200
          )
        ),
      previous_play_status TEXT
        CHECK (
          previous_play_status IS NULL
          OR previous_play_status IN (
            'unreleased',
            'not_started',
            'playing',
            'on_hold',
            'waiting',
            'completed'
          )
        ),
      next_play_status TEXT
        CHECK (
          next_play_status IS NULL
          OR next_play_status IN (
            'unreleased',
            'not_started',
            'playing',
            'on_hold',
            'waiting',
            'completed'
          )
        ),
      summary TEXT NOT NULL
        CHECK (
          summary = trim(summary)
          AND length(summary) BETWEEN 1 AND 500
        ),
      details_json TEXT NOT NULL
        CHECK (
          json_valid(details_json)
          AND json_type(details_json) = 'object'
        ),
      CHECK (
        (game_id IS NULL AND game_title IS NULL)
        OR
        (game_id IS NOT NULL AND game_title IS NOT NULL)
      ),
      CHECK (
        (collection_id IS NULL AND collection_name IS NULL)
        OR
        (collection_id IS NOT NULL AND collection_name IS NOT NULL)
      )
    ) STRICT;

    CREATE INDEX backlog_history_occurred_index
      ON backlog_history_entries (
        occurred_at DESC,
        id DESC
      );

    CREATE INDEX backlog_history_game_index
      ON backlog_history_entries (
        game_id,
        occurred_at DESC
      )
      WHERE game_id IS NOT NULL;

    CREATE INDEX backlog_history_collection_index
      ON backlog_history_entries (
        collection_id,
        occurred_at DESC
      )
      WHERE collection_id IS NOT NULL;

    CREATE INDEX backlog_history_action_index
      ON backlog_history_entries (
        action,
        occurred_at DESC
      );
  `,
};
