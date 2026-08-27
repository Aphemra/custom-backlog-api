import type { DatabaseSync } from "node:sqlite";
import { HttpError } from "../../errors/httpError.js";
import { AppSettingsRepository } from "../settings/appSettingsRepository.js";

const PLAYSTATION_SYNC_STATE_KEY = "playstation_trophy_sync_state";

interface SyncStateRow {
  value_json: string;
}

type Clock = () => Date;

export class PlayStationSyncCooldownService {
  private readonly settingsRepository: AppSettingsRepository;

  constructor(
    private readonly database: DatabaseSync,
    private readonly clock: Clock = () => new Date(),
  ) {
    this.settingsRepository = new AppSettingsRepository(database);
  }

  enforceAndRecordAttempt(): void {
    const now = this.clock();
    const nowMilliseconds = now.getTime();

    if (Number.isNaN(nowMilliseconds)) {
      throw new Error("The PlayStation sync clock returned an invalid date.");
    }

    const startedAt = now.toISOString();

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const settings = this.settingsRepository.get();
      const lastStartedAt = this.readLastStartedAt();

      if (settings.trophySyncCooldownEnabled && lastStartedAt !== null) {
        const nextAllowedMilliseconds =
          Date.parse(lastStartedAt) +
          settings.trophySyncCooldownSeconds * 1_000;

        const remainingMilliseconds = nextAllowedMilliseconds - nowMilliseconds;

        if (remainingMilliseconds > 0) {
          const remainingSeconds = Math.ceil(remainingMilliseconds / 1_000);

          throw new HttpError(
            429,
            "playstation_sync_cooldown_active",
            `PlayStation trophy synchronization is available again in ${remainingSeconds} ${
              remainingSeconds === 1 ? "second" : "seconds"
            }.`,
            {
              retryAfterSeconds: remainingSeconds,
              nextAllowedAt: new Date(nextAllowedMilliseconds).toISOString(),
            },
          );
        }
      }

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
        .run(PLAYSTATION_SYNC_STATE_KEY, JSON.stringify(startedAt), startedAt);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private readLastStartedAt(): string | null {
    const row = this.database
      .prepare(
        `
          SELECT value_json
          FROM app_settings
          WHERE key = ?
        `,
      )
      .get(PLAYSTATION_SYNC_STATE_KEY) as SyncStateRow | undefined;

    if (row === undefined) {
      return null;
    }

    let storedValue: unknown;

    try {
      storedValue = JSON.parse(row.value_json) as unknown;
    } catch {
      throw new Error("Stored PlayStation trophy-sync state is invalid.");
    }

    if (
      typeof storedValue !== "string" ||
      Number.isNaN(Date.parse(storedValue))
    ) {
      throw new Error("Stored PlayStation trophy-sync state is invalid.");
    }

    return storedValue;
  }
}
