import { HttpError } from "../../errors/httpError.js";
import type { PlayStationRetryPolicy } from "./playStationTypes.js";

export const DEFAULT_PLAYSTATION_RETRY_POLICY: PlayStationRetryPolicy = {
  maximumRetriesPerSync: 5,
  maximumAttemptsPerRequest: 2,
};

export class PlayStationRetryBudget {
  private retryCount = 0;

  constructor(
    private readonly policy: PlayStationRetryPolicy = DEFAULT_PLAYSTATION_RETRY_POLICY,
  ) {
    if (
      !Number.isInteger(policy.maximumRetriesPerSync) ||
      policy.maximumRetriesPerSync < 0 ||
      !Number.isInteger(policy.maximumAttemptsPerRequest) ||
      policy.maximumAttemptsPerRequest < 1
    ) {
      throw new Error("The PlayStation retry policy is invalid.");
    }
  }

  get retriesUsed(): number {
    return this.retryCount;
  }

  reserveRetry(attemptsAlreadyMade: number): void {
    if (!Number.isInteger(attemptsAlreadyMade) || attemptsAlreadyMade < 1) {
      throw new Error(
        "Retry accounting requires at least one completed attempt.",
      );
    }

    if (attemptsAlreadyMade >= this.policy.maximumAttemptsPerRequest) {
      throw new HttpError(
        503,
        "playstation_request_retry_limit_reached",
        "The PlayStation request retry limit was reached.",
      );
    }

    if (this.retryCount >= this.policy.maximumRetriesPerSync) {
      throw new HttpError(
        503,
        "playstation_sync_retry_budget_exhausted",
        "The PlayStation synchronization retry budget was exhausted.",
      );
    }

    this.retryCount += 1;
  }
}
