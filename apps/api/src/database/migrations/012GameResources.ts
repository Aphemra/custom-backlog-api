import type { Migration } from "../migration.js";

export const gameResourcesMigration: Migration = {
  version: 12,
  name: "game_resources",
  sql: `
    CREATE TABLE game_resources (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL
        REFERENCES library_games(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL
        CHECK (
          resource_type IN (
            'trophy_page',
            'guide',
            'interactive_map'
          )
        ),
      provider TEXT NOT NULL
        CHECK (
          provider IN (
            'psnprofiles',
            'powerpyx',
            'mapgenie',
            'other'
          )
        ),
      url TEXT NOT NULL
        CHECK (
          url = trim(url)
          AND length(url) BETWEEN 1 AND 2048
          AND substr(url, 1, 8) = 'https://'
        ),
      label TEXT
        CHECK (
          label IS NULL
          OR (
            label = trim(label)
            AND length(label) BETWEEN 1 AND 100
          )
        ),
      sort_order INTEGER NOT NULL
        CHECK (sort_order >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (
        (
          resource_type = 'trophy_page'
          AND provider = 'psnprofiles'
        )
        OR (
          resource_type = 'guide'
          AND provider IN (
            'psnprofiles',
            'powerpyx',
            'other'
          )
        )
        OR (
          resource_type = 'interactive_map'
          AND provider IN (
            'mapgenie',
            'other'
          )
        )
      )
    ) STRICT;

    CREATE INDEX game_resources_game_order_index
      ON game_resources (
        game_id,
        sort_order,
        id
      );

    CREATE UNIQUE INDEX game_resources_game_url_unique
      ON game_resources (
        game_id,
        url
      );

    CREATE UNIQUE INDEX game_resources_trophy_page_unique
      ON game_resources (
        game_id
      )
      WHERE resource_type = 'trophy_page';
  `,
};
