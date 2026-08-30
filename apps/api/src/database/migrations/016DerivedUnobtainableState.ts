import type { Migration } from "../migration.js";

export const derivedUnobtainableStateMigration: Migration = {
  version: 16,
  name: "derived_unobtainable_state",
  sql: `
    UPDATE library_games
    SET is_unobtainable = CASE
      WHEN EXISTS (
        SELECT 1
        FROM playstation_trophy_availability_overrides availability
        WHERE availability.game_id = library_games.id
      )
      THEN 1
      ELSE 0
    END;
  `,
};
