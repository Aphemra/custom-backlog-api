import type { Migration } from "../migration.js";

export const playStationTrophyStorageMigration: Migration = {
  version: 7,
  name: "playstation_trophy_storage",
  sql: `
    CREATE TABLE playstation_trophy_sets (
      game_id TEXT PRIMARY KEY
        REFERENCES playstation_game_links(game_id) ON DELETE CASCADE,
      np_communication_id TEXT NOT NULL UNIQUE
        CHECK (length(trim(np_communication_id)) > 0),
      np_service_name TEXT NOT NULL
        CHECK (np_service_name IN ('trophy', 'trophy2')),
      trophy_set_version TEXT NOT NULL
        CHECK (length(trim(trophy_set_version)) > 0),
      title_name TEXT NOT NULL
        CHECK (length(trim(title_name)) > 0),
      title_detail TEXT,
      platforms_json TEXT NOT NULL
        CHECK (
          json_valid(platforms_json)
          AND json_type(platforms_json) = 'array'
        ),
      icon_url TEXT NOT NULL
        CHECK (length(trim(icon_url)) > 0),
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      has_trophy_groups INTEGER NOT NULL
        CHECK (has_trophy_groups IN (0, 1)),
      bronze_total INTEGER NOT NULL DEFAULT 0
        CHECK (bronze_total >= 0),
      silver_total INTEGER NOT NULL DEFAULT 0
        CHECK (silver_total >= 0),
      gold_total INTEGER NOT NULL DEFAULT 0
        CHECK (gold_total >= 0),
      platinum_total INTEGER NOT NULL DEFAULT 0
        CHECK (platinum_total IN (0, 1)),
      last_observed_title_updated_at TEXT,
      definitions_refreshed_at TEXT NOT NULL,
      earnings_refreshed_at TEXT,
      definition_payload_json TEXT NOT NULL
        CHECK (json_valid(definition_payload_json)),
      earnings_payload_json TEXT
        CHECK (
          earnings_payload_json IS NULL
          OR json_valid(earnings_payload_json)
        ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX playstation_trophy_sets_provider_index
      ON playstation_trophy_sets (
        np_communication_id,
        np_service_name
      );

    CREATE TABLE playstation_trophy_groups (
      game_id TEXT NOT NULL
        REFERENCES playstation_trophy_sets(game_id) ON DELETE CASCADE,
      trophy_group_id TEXT NOT NULL
        CHECK (length(trim(trophy_group_id)) > 0),
      name TEXT NOT NULL
        CHECK (length(trim(name)) > 0),
      detail TEXT,
      icon_url TEXT NOT NULL
        CHECK (length(trim(icon_url)) > 0),
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      bronze_total INTEGER NOT NULL
        CHECK (bronze_total >= 0),
      silver_total INTEGER NOT NULL
        CHECK (silver_total >= 0),
      gold_total INTEGER NOT NULL
        CHECK (gold_total >= 0),
      platinum_total INTEGER NOT NULL
        CHECK (platinum_total IN (0, 1)),
      payload_json TEXT NOT NULL
        CHECK (json_valid(payload_json)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_group_id)
    ) STRICT;

    CREATE INDEX playstation_trophy_groups_game_index
      ON playstation_trophy_groups (
        game_id,
        trophy_group_id
      );

    CREATE TABLE playstation_trophies (
      game_id TEXT NOT NULL,
      trophy_id INTEGER NOT NULL
        CHECK (trophy_id >= 0),
      trophy_group_id TEXT NOT NULL
        CHECK (length(trim(trophy_group_id)) > 0),
      trophy_type TEXT NOT NULL
        CHECK (trophy_type IN (
          'bronze',
          'silver',
          'gold',
          'platinum'
        )),
      name TEXT,
      detail TEXT,
      icon_url TEXT,
      icon_image_id TEXT
        REFERENCES cached_images(id) ON DELETE SET NULL,
      is_secret INTEGER NOT NULL
        CHECK (is_secret IN (0, 1)),
      is_earned INTEGER NOT NULL DEFAULT 0
        CHECK (is_earned IN (0, 1)),
      earned_at TEXT,
      rarity INTEGER
        CHECK (rarity IS NULL OR rarity BETWEEN 0 AND 3),
      earned_rate REAL
        CHECK (
          earned_rate IS NULL
          OR earned_rate BETWEEN 0 AND 100
        ),
      progress_target_value TEXT,
      progress_value TEXT,
      progress_rate REAL
        CHECK (
          progress_rate IS NULL
          OR progress_rate BETWEEN 0 AND 100
        ),
      reward_name TEXT,
      reward_image_url TEXT,
      definition_payload_json TEXT NOT NULL
        CHECK (json_valid(definition_payload_json)),
      earnings_payload_json TEXT
        CHECK (
          earnings_payload_json IS NULL
          OR json_valid(earnings_payload_json)
        ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (game_id, trophy_id),
      FOREIGN KEY (game_id, trophy_group_id)
        REFERENCES playstation_trophy_groups (
          game_id,
          trophy_group_id
        )
        ON DELETE CASCADE,
      CHECK (is_earned = 1 OR earned_at IS NULL)
    ) STRICT;

    CREATE INDEX playstation_trophies_group_index
      ON playstation_trophies (
        game_id,
        trophy_group_id,
        trophy_id
      );

    CREATE INDEX playstation_trophies_earned_index
      ON playstation_trophies (
        game_id,
        is_earned,
        earned_at
      );
  `,
};
