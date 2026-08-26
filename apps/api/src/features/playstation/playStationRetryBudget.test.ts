import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../../errors/httpError.js";
import { PlayStationRetryBudget } from "./playStationRetryBudget.js";

test("allows no more than one retry for an individual request", () => {
  const budget = new PlayStationRetryBudget({
    maximumRetriesPerSync: 5,
    maximumAttemptsPerRequest: 2,
  });

  budget.reserveRetry(1);

  assert.throws(
    () => budget.reserveRetry(2),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, "playstation_request_retry_limit_reached");
      return true;
    },
  );
});

test("allows no more than five retries across a synchronization", () => {
  const budget = new PlayStationRetryBudget({
    maximumRetriesPerSync: 5,
    maximumAttemptsPerRequest: 2,
  });

  for (let retry = 0; retry < 5; retry += 1) {
    budget.reserveRetry(1);
  }

  assert.equal(budget.retriesUsed, 5);

  assert.throws(
    () => budget.reserveRetry(1),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, "playstation_sync_retry_budget_exhausted");
      return true;
    },
  );
});
