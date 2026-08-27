import type { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type UpdateAppSettingsInput,
} from "./appSettingsTypes.js";
import { parseStoredAppSettings } from "./appSettingsValidation.js";

const APPLICATION_SETTINGS_KEY = "application";

interface SettingsRow {
  value_json: string;
}

export class AppSettingsRepository {
  constructor(private readonly database: DatabaseSync) {}

  get(): AppSettings {
    const row = this.database
      .prepare(
        `
          SELECT value_json
          FROM app_settings
          WHERE key = ?
        `,
      )
      .get(APPLICATION_SETTINGS_KEY) as SettingsRow | undefined;

    if (row === undefined) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    try {
      return parseStoredAppSettings(JSON.parse(row.value_json) as unknown);
    } catch {
      throw new Error("Stored application settings are invalid.");
    }
  }

  update(input: UpdateAppSettingsInput): AppSettings {
    const settings: AppSettings = {
      ...this.get(),
      ...input,
    };

    this.database
      .prepare(
        `
          INSERT INTO app_settings (
            key,
            value_json,
            updated_at
          ) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        `,
      )
      .run(
        APPLICATION_SETTINGS_KEY,
        JSON.stringify(settings),
        new Date().toISOString(),
      );

    return settings;
  }
}
