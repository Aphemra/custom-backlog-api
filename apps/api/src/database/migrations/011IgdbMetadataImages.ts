import type { Migration } from "../migration.js";

export const igdbMetadataImagesMigration: Migration = {
  version: 11,
  name: "igdb_metadata_images",
  sql: `
    CREATE TABLE igdb_metadata_images (
      metadata_id TEXT NOT NULL
        REFERENCES external_game_metadata(id) ON DELETE CASCADE,
      image_id TEXT NOT NULL
        REFERENCES cached_images(id) ON DELETE CASCADE,
      role TEXT NOT NULL
        CHECK (role IN ('cover', 'screenshot', 'artwork')),
      sort_order INTEGER NOT NULL
        CHECK (sort_order >= 0),
      width INTEGER CHECK (width IS NULL OR width > 0),
      height INTEGER CHECK (height IS NULL OR height > 0),
      linked_at TEXT NOT NULL,
      PRIMARY KEY (metadata_id, image_id, role),
      UNIQUE (metadata_id, role, sort_order)
    ) STRICT;

    CREATE INDEX igdb_metadata_images_order_index
      ON igdb_metadata_images (
        metadata_id,
        role,
        sort_order
      );
  `,
};
