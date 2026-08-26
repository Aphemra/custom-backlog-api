import assert from "node:assert/strict";
import { test } from "node:test";
import { readPlayStationCredentials } from "./playStationConfig.js";

test("reads a complete dedicated-reader configuration", () => {
  const credentials = readPlayStationCredentials({
    PSN_READER_NPSSO: "n".repeat(64),
    PSN_READER_ONLINE_ID: "BacklogReader",
    PSN_TARGET_ONLINE_ID: "MainAccount",
  });

  assert.deepEqual(credentials, {
    readerNpsso: "n".repeat(64),
    readerOnlineId: "BacklogReader",
    targetOnlineId: "MainAccount",
  });
});

test("permits PlayStation integration to remain unconfigured", () => {
  assert.deepEqual(readPlayStationCredentials({}), {
    readerNpsso: null,
    readerOnlineId: null,
    targetOnlineId: null,
  });
});

test("rejects an invalid NPSSO without including it in the error", () => {
  assert.throws(
    () =>
      readPlayStationCredentials({
        PSN_READER_NPSSO: "secret-that-must-not-appear-in-errors",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /secret-that-must-not-appear/);
      return true;
    },
  );
});

test("rejects using the target account as the reader account", () => {
  assert.throws(
    () =>
      readPlayStationCredentials({
        PSN_READER_ONLINE_ID: "SameAccount",
        PSN_TARGET_ONLINE_ID: "sameaccount",
      }),
    /must identify different accounts/,
  );
});
