import type { PlayStationRequestPolicy } from "./playStationTypes.js";

export const DEFAULT_PLAYSTATION_REQUEST_POLICY: PlayStationRequestPolicy = {
  minimumIntervalMs: 1_000,
};

type Clock = () => number;
type Delay = (milliseconds: number) => Promise<void>;

const systemDelay: Delay = async (milliseconds) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export class PlayStationRequestGate {
  private queue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;
  private requestCount = 0;

  constructor(
    private readonly policy: PlayStationRequestPolicy = DEFAULT_PLAYSTATION_REQUEST_POLICY,
    private readonly clock: Clock = Date.now,
    private readonly delay: Delay = systemDelay,
  ) {
    if (
      !Number.isInteger(policy.minimumIntervalMs) ||
      policy.minimumIntervalMs < 0
    ) {
      throw new Error("The PlayStation request policy is invalid.");
    }
  }

  get requestsUsed(): number {
    return this.requestCount;
  }

  execute<T>(operation: () => Promise<T>): Promise<T> {
    this.requestCount += 1;

    const result = this.queue.then(async () => {
      const waitMilliseconds = Math.max(0, this.nextRequestAt - this.clock());

      if (waitMilliseconds > 0) {
        await this.delay(waitMilliseconds);
      }

      this.nextRequestAt = this.clock() + this.policy.minimumIntervalMs;

      return operation();
    });

    this.queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}
