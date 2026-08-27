import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import { PlayStationSyncExecutionLock } from "./playStationSyncExecutionLock.js";

test("rejects overlapping syncs and releases the lock afterward", async () => {
  const lock = new PlayStationSyncExecutionLock();

  let releaseFirstSync: (() => void) | undefined;

  const firstSync = lock.run(
    () =>
      new Promise<string>((resolve) => {
        releaseFirstSync = () => resolve("first sync completed");
      }),
  );

  await assert.rejects(
    lock.run(async () => "overlapping sync completed"),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "playstation_sync_in_progress");
      assert.equal(
        error.message,
        "A PlayStation trophy synchronization is already in progress.",
      );

      return true;
    },
  );

  assert.notEqual(releaseFirstSync, undefined);
  releaseFirstSync?.();

  assert.equal(await firstSync, "first sync completed");

  await assert.rejects(
    lock.run(async () => {
      throw new Error("simulated sync failure");
    }),
    /simulated sync failure/,
  );

  assert.equal(
    await lock.run(async () => "replacement sync completed"),
    "replacement sync completed",
  );
});
