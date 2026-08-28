import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { AppSettingsRepository } from "./appSettingsRepository.js";
import { DEFAULT_APP_SETTINGS } from "./appSettingsTypes.js";

test("loads defaults and persists partial settings updates", () => {
  const database = openDatabase(":memory:");

  try {
    const repository = new AppSettingsRepository(database);

    assert.deepEqual(repository.get(), DEFAULT_APP_SETTINGS);

    const expectedSettings = {
      ...DEFAULT_APP_SETTINGS,
      trophySyncCooldownEnabled: false,
      notificationDurationSeconds: 8,
      accentColor: "#ec4899",
    };

    assert.deepEqual(
      repository.update({
        trophySyncCooldownEnabled: false,
        notificationDurationSeconds: 8,
        accentColor: "#ec4899",
      }),
      expectedSettings,
    );

    const reloadedRepository = new AppSettingsRepository(database);

    assert.deepEqual(reloadedRepository.get(), expectedSettings);
  } finally {
    database.close();
  }
});
