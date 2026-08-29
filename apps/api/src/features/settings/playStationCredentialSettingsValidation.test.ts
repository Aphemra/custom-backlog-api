import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import {
  parseUpdatePlayStationCredentialSettingsInput,
  requireDistinctPlayStationAccounts,
} from "./playStationCredentialSettingsValidation.js";

test("validates partial PlayStation credential updates", () => {
  assert.deepEqual(
    parseUpdatePlayStationCredentialSettingsInput({
      readerOnlineId: " BacklogReader ",
      targetOnlineId: "Main_Account",
      readerNpsso: ` ${"n".repeat(64)} `,
      renewalReminderDays: 10,
    }),
    {
      readerOnlineId: "BacklogReader",
      targetOnlineId: "Main_Account",
      readerNpsso: "n".repeat(64),
      renewalReminderDays: 10,
    },
  );

  assert.deepEqual(
    parseUpdatePlayStationCredentialSettingsInput({
      readerNpsso: null,
    }),
    {
      readerNpsso: null,
    },
  );
});

test("rejects invalid PlayStation credential updates", () => {
  for (const value of [
    {},
    {
      readerOnlineId: "x",
    },
    {
      targetOnlineId: "invalid account name",
    },
    {
      readerNpsso: "too-short",
    },
    {
      renewalReminderDays: 0,
    },
    {
      renewalReminderDays: 31,
    },
    {
      unknownSetting: true,
    },
  ]) {
    assert.throws(
      () => parseUpdatePlayStationCredentialSettingsInput(value),
      (error: unknown) =>
        error instanceof HttpError && error.statusCode === 400,
    );
  }
});

test("rejects using the target account as the reader", () => {
  assert.throws(
    () =>
      requireDistinctPlayStationAccounts(
        {
          readerOnlineId: "BacklogReader",
          targetOnlineId: "MainAccount",
          readerNpsso: null,
          npssoUpdatedAt: null,
          npssoExpectedRenewalAt: null,
          renewalReminderDays: 7,
        },
        {
          targetOnlineId: "backlogreader",
        },
      ),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === "playstation_reader_is_target",
  );
});
