import type { Migration } from "../migration.js";

export const igdbGameDetailsMigration: Migration = {
  version: 10,
  name: "igdb_game_details",
  sql: `
    CREATE TABLE igdb_game_details (
      metadata_id TEXT PRIMARY KEY
        REFERENCES external_game_metadata(id) ON DELETE CASCADE,
      slug TEXT,
      igdb_url TEXT,
      summary TEXT,
      storyline TEXT,
      platforms_json TEXT NOT NULL
        CHECK (json_valid(platforms_json)),
      releases_json TEXT NOT NULL
        CHECK (json_valid(releases_json)),
      cover_image_id TEXT,
      screenshots_json TEXT NOT NULL
        CHECK (json_valid(screenshots_json)),
      artworks_json TEXT NOT NULL
        CHECK (json_valid(artworks_json)),
      genres_json TEXT NOT NULL
        CHECK (json_valid(genres_json)),
      game_modes_json TEXT NOT NULL
        CHECK (json_valid(game_modes_json)),
      companies_json TEXT NOT NULL
        CHECK (json_valid(companies_json)),
      collections_json TEXT NOT NULL
        CHECK (json_valid(collections_json)),
      franchises_json TEXT NOT NULL
        CHECK (json_valid(franchises_json)),
      game_type_external_id TEXT NOT NULL,
      game_type_name TEXT,
      parent_game_external_id TEXT,
      version_title TEXT,
      total_rating REAL CHECK (total_rating >= 0),
      total_rating_count INTEGER NOT NULL
        CHECK (total_rating_count >= 0),
      time_hastily_seconds INTEGER
        CHECK (time_hastily_seconds > 0),
      time_normally_seconds INTEGER
        CHECK (time_normally_seconds > 0),
      time_completely_seconds INTEGER
        CHECK (time_completely_seconds > 0),
      time_submission_count INTEGER NOT NULL
        CHECK (time_submission_count >= 0),
      provider_updated_at TEXT,
      is_dlc INTEGER NOT NULL CHECK (is_dlc IN (0, 1)),
      stored_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX igdb_game_details_type_index
      ON igdb_game_details (
        game_type_external_id,
        is_dlc
      );
  `,
};
