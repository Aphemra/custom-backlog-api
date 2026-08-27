import assert from "node:assert/strict";
import { test } from "node:test";
import { PlayStationSyncProgressTracker } from "./playStationSyncProgressTracker.js";

test("tracks running, completed, and failed PlayStation synchronizations", () => {
  let timestamp = Date.parse("2026-08-27T12:00:00.000Z");
  const tracker = new PlayStationSyncProgressTracker(() => new Date(timestamp));

  assert.equal(tracker.getSnapshot().status, "idle");

  tracker.start("progress");
  timestamp += 1_000;
  tracker.update({
    phase: "caching_artwork",
    completedItems: 4,
    totalItems: 10,
    subtaskCompletedItems: 12,
    subtaskTotalItems: 50,
    currentItem: "Astro Bot",
    message: "Caching trophy artwork.",
  });

  assert.deepEqual(tracker.getSnapshot(), {
    status: "running",
    operation: "progress",
    phase: "caching_artwork",
    completedItems: 4,
    totalItems: 10,
    subtaskCompletedItems: 12,
    subtaskTotalItems: 50,
    currentItem: "Astro Bot",
    message: "Caching trophy artwork.",
    startedAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:01.000Z",
    finishedAt: null,
    errorMessage: null,
  });

  timestamp += 1_000;
  tracker.succeed();

  assert.equal(tracker.getSnapshot().status, "succeeded");
  assert.equal(tracker.getSnapshot().phase, "complete");
  assert.equal(tracker.getSnapshot().completedItems, 10);

  timestamp += 1_000;
  tracker.start("full");
  timestamp += 1_000;
  tracker.fail(new Error("Sony stopped responding."));

  assert.equal(tracker.getSnapshot().status, "failed");
  assert.equal(tracker.getSnapshot().phase, "failed");
  assert.equal(tracker.getSnapshot().errorMessage, "Sony stopped responding.");
});
