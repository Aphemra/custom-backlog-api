import type { Migration } from "../migration.js";

export const integrationStorageMigration: Migration = {
  version: 2,
  name: "integration_storage",
  sql: `
    CREATE TABLE playstation_game_links (
      game_id TEXT PRIMARY KEY
        REFERENCES library_games(id) ON DELETE CASCADE,
      np_communication_id TEXT NOT NULL UNIQUE
        CHECK (length(trim(np_communication_id)) > 0),
      np_service_name TEXT NOT NULL
        CHECK (np_service_name IN ('trophy', 'trophy2')),
      psn_title_name TEXT NOT NULL
        CHECK (length(trim(psn_title_name)) > 0),
      platforms_json TEXT NOT NULL
        CHECK (
          json_valid(platforms_json)
          AND json_type(platforms_json) = 'array'
        ),
      icon_url TEXT,
      link_source TEXT NOT NULL
        CHECK (link_source IN (
          'sync_created',
          'automatic_match',
          'manual_match'
        )),
      payload_json TEXT NOT NULL
        CHECK (json_valid(payload_json)),
      linked_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX playstation_game_links_last_seen_index
      ON playstation_game_links (last_seen_at DESC);

    CREATE TABLE cached_images (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL
        CHECK (provider IN ('igdb', 'playstation')),
      source_key TEXT NOT NULL
        CHECK (length(trim(source_key)) > 0),
      source_url TEXT NOT NULL
        CHECK (length(trim(source_url)) > 0),
      file_name TEXT UNIQUE,
      content_type TEXT
        CHECK (
          content_type IS NULL
          OR content_type IN ('image/jpeg', 'image/png', 'image/webp')
        ),
      byte_size INTEGER
        CHECK (byte_size IS NULL OR byte_size >= 0),
      etag TEXT,
      last_modified TEXT,
      fetched_at TEXT,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (provider, source_key),
      CHECK (
        (file_name IS NULL AND content_type IS NULL AND byte_size IS NULL
          AND fetched_at IS NULL)
        OR
        (file_name IS NOT NULL AND content_type IS NOT NULL
          AND byte_size IS NOT NULL AND fetched_at IS NOT NULL)
      )
    ) STRICT;

    CREATE INDEX cached_images_provider_index
      ON cached_images (provider, updated_at DESC);

    CREATE TABLE library_game_images (
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL
        REFERENCES cached_images(id) ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('cover', 'icon', 'background')),
      sort_order INTEGER NOT NULL DEFAULT 0
        CHECK (sort_order >= 0),
      linked_at TEXT NOT NULL,
      PRIMARY KEY (game_id, image_id, role)
    ) STRICT;

    CREATE INDEX library_game_images_order_index
      ON library_game_images (game_id, role, sort_order);

    ALTER TABLE trophy_sync_runs
      ADD COLUMN reader_account_id TEXT;

    ALTER TABLE trophy_sync_runs
      ADD COLUMN expected_title_count INTEGER
        CHECK (expected_title_count IS NULL OR expected_title_count >= 0);

    ALTER TABLE trophy_sync_runs
      ADD COLUMN processed_title_count INTEGER NOT NULL DEFAULT 0
        CHECK (processed_title_count >= 0);
  `,
};
