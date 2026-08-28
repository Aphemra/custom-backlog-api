import type { Migration } from "../migration.js";

export const hiddenGamesSavedViewMigration: Migration = {
  version: 13,
  name: "hidden_games_saved_view",
  sql: `
    INSERT INTO saved_views (
      id,
      builtin_key,
      name,
      filters_json,
      sort_json,
      sort_order,
      is_builtin,
      created_at,
      updated_at
    ) VALUES (
      'builtin-hidden-games',
      'hidden_games',
      'Hidden Games',
      '{"hiddenMode":"hidden"}',
      '{"field":"priorityRank","direction":"asc"}',
      70,
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `,
};
