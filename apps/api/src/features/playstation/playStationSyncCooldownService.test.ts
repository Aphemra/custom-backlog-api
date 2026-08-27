import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { HttpError } from "../../errors/httpError.js";
import { AppSettingsRepository } from "../settings/appSettingsRepository.js";
import { PlayStationSyncCooldownService } from "./playStationSyncCooldownService.js";

test("persists and enforces the PlayStation sync cooldown", () => {
  const database = openDatabase(":memory:");
  let currentTime = new Date("2026-08-27T12:00:00.000Z");

  try {
    const service = new PlayStationSyncCooldownService(
      database,
      () => currentTime,
    );

    service.enforceAndRecordAttempt();

    const reloadedService = new PlayStationSyncCooldownService(
      database,
      () => currentTime,
    );

    assert.throws(
      () => reloadedService.enforceAndRecordAttempt(),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.statusCode, 429);
        assert.equal(error.code, "playstation_sync_cooldown_active");
        assert.equal(
          error.message,
          "PlayStation trophy synchronization is available again in 300 seconds.",
        );
        assert.deepEqual(error.details, {
          retryAfterSeconds: 300,
          nextAllowedAt: "2026-08-27T12:05:00.000Z",
        });

        return true;
      },
    );

    currentTime = new Date("2026-08-27T12:04:59.001Z");

    assert.throws(
      () => reloadedService.enforceAndRecordAttempt(),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(
          error.message,
          "PlayStation trophy synchronization is available again in 1 second.",
        );
        assert.deepEqual(error.details, {
          retryAfterSeconds: 1,
          nextAllowedAt: "2026-08-27T12:05:00.000Z",
        });

        return true;
      },
    );

    currentTime = new Date("2026-08-27T12:05:00.000Z");

    assert.doesNotThrow(() => {
      reloadedService.enforceAndRecordAttempt();
    });
  } finally {
    database.close();
  }
});

test("allows consecutive sync attempts when the cooldown is disabled", () => {
  const database = openDatabase(":memory:");
  const currentTime = new Date("2026-08-27T12:00:00.000Z");

  try {
    new AppSettingsRepository(database).update({
      trophySyncCooldownEnabled: false,
    });

    const service = new PlayStationSyncCooldownService(
      database,
      () => currentTime,
    );

    assert.doesNotThrow(() => {
      service.enforceAndRecordAttempt();
      service.enforceAndRecordAttempt();
    });
  } finally {
    database.close();
  }
});
