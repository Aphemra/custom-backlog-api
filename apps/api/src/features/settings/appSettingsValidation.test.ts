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
      accentColor: "#FF00AA",
      notStartedColor: "#7C3AED",
      playingColor: "#14B8A6",
      onHoldColor: "#64748B",
      waitingColor: "#F59E0B",
      completedColor: "#EAB308",
      unreleasedColor: "#3B82F6",
      unobtainableColor: "#EF4444",
    }),
    {
      trophySyncCooldownEnabled: false,
      trophySyncCooldownSeconds: 600,
      notificationDurationSeconds: 8,
      accentColor: "#ff00aa",
      notStartedColor: "#7c3aed",
      playingColor: "#14b8a6",
      onHoldColor: "#64748b",
      waitingColor: "#f59e0b",
      completedColor: "#eab308",
      unreleasedColor: "#3b82f6",
      unobtainableColor: "#ef4444",
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
      accentColor: "purple",
    },
    {
      playingColor: "#12345",
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
