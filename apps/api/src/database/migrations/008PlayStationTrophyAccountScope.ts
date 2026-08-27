import type { Migration } from "../migration.js";

export const playStationTrophyAccountScopeMigration: Migration = {
  version: 8,
  name: "playstation_trophy_account_scope",
  sql: `
    ALTER TABLE playstation_trophy_sets
      ADD COLUMN earnings_account_id TEXT
        CHECK (
          earnings_account_id IS NULL
          OR length(trim(earnings_account_id)) > 0
        );
  `,
};
