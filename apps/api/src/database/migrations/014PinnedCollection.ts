import type { Migration } from "../migration.js";

export const pinnedCollectionMigration: Migration = {
  version: 14,
  name: "pinned_collection",
  sql: `
    ALTER TABLE collections
    ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0
      CHECK (is_pinned IN (0, 1));

    CREATE UNIQUE INDEX collections_single_pinned
    ON collections (is_pinned)
    WHERE is_pinned = 1;
  `,
};
