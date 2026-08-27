import type { Migration } from "../migration.js";

export const appSettingsDefaultsMigration: Migration = {
  version: 5,
  name: "app_settings_defaults",
  sql: `
    INSERT INTO app_settings (
      key,
      value_json,
      updated_at
    ) VALUES (
      'application',
      '{"trophySyncCooldownEnabled":true,"trophySyncCooldownSeconds":300,"notificationDurationSeconds":5}',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(key) DO NOTHING;
  `,
};
