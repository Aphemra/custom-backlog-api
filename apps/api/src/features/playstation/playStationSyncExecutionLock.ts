import { HttpError } from "../../errors/httpError.js";

export class PlayStationSyncExecutionLock {
  private syncInProgress = false;

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.syncInProgress) {
      throw new HttpError(
        409,
        "playstation_sync_in_progress",
        "A PlayStation trophy synchronization is already in progress.",
      );
    }

    this.syncInProgress = true;

    try {
      return await operation();
    } finally {
      this.syncInProgress = false;
    }
  }
}
