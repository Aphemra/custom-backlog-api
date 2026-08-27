import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import { parseUpdateAppSettingsInput } from "./appSettingsValidation.js";

test("validates partial application-settings updates", () => {
  assert.deepEqual(
    parseUpdateAppSettingsInput({
      trophySyncCooldownEnabled: false,
      trophySyncCooldownSeconds: 600,
      notificationDurationSeconds: 8,
    }),
    {
      trophySyncCooldownEnabled: false,
      trophySyncCooldownSeconds: 600,
      notificationDurationSeconds: 8,
    },
  );
});

test("rejects invalid or unknown application settings", () => {
  for (const value of [
    {},
    {
      trophySyncCooldownEnabled: "yes",
    },
    {
      trophySyncCooldownSeconds: 0,
    },
    {
      trophySyncCooldownSeconds: 86_401,
    },
    {
      notificationDurationSeconds: 0,
    },
    {
      notificationDurationSeconds: 61,
    },
    {
      unknownSetting: true,
    },
  ]) {
    assert.throws(
      () => parseUpdateAppSettingsInput(value),
      (error: unknown) =>
        error instanceof HttpError && error.statusCode === 400,
    );
  }
});
