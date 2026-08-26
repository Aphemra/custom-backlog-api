import assert from "node:assert/strict";
import { test } from "node:test";
import { PlayStationRequestGate } from "./playStationRequestGate.js";

test("serializes PlayStation requests and spaces their start times", async () => {
  let currentTime = 10_000;
  const startTimes: number[] = [];
  const delays: number[] = [];

  const gate = new PlayStationRequestGate(
    { minimumIntervalMs: 1_000 },
    () => currentTime,
    async (milliseconds) => {
      delays.push(milliseconds);
      currentTime += milliseconds;
    },
  );

  const results = await Promise.all([
    gate.execute(async () => {
      startTimes.push(currentTime);
      return "first";
    }),
    gate.execute(async () => {
      startTimes.push(currentTime);
      return "second";
    }),
    gate.execute(async () => {
      startTimes.push(currentTime);
      return "third";
    }),
  ]);

  assert.deepEqual(results, ["first", "second", "third"]);
  assert.deepEqual(startTimes, [10_000, 11_000, 12_000]);
  assert.deepEqual(delays, [1_000, 1_000]);
  assert.equal(gate.requestsUsed, 3);
});

test("continues the queue after a failed request", async () => {
  const gate = new PlayStationRequestGate({
    minimumIntervalMs: 0,
  });

  await assert.rejects(
    gate.execute(async () => {
      throw new Error("simulated failure");
    }),
    /simulated failure/,
  );

  assert.equal(await gate.execute(async () => "continued"), "continued");
});
