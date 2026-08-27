export type PlayStationSyncOperation = "progress" | "full";

export type PlayStationSyncProgressStatus =
  | "idle"
  | "running"
  | "succeeded"
  | "failed";

export type PlayStationSyncProgressPhase =
  | "idle"
  | "fetching_titles"
  | "fetching_trophies"
  | "caching_artwork"
  | "saving_snapshots"
  | "complete"
  | "failed";

export interface PlayStationSyncProgressSnapshot {
  status: PlayStationSyncProgressStatus;
  operation: PlayStationSyncOperation | null;
  phase: PlayStationSyncProgressPhase;
  completedItems: number;
  totalItems: number | null;
  subtaskCompletedItems: number | null;
  subtaskTotalItems: number | null;
  currentItem: string | null;
  message: string;
  startedAt: string | null;
  updatedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface PlayStationSyncProgressUpdate {
  phase: Exclude<PlayStationSyncProgressPhase, "idle" | "complete" | "failed">;
  completedItems: number;
  totalItems: number | null;
  subtaskCompletedItems?: number | null;
  subtaskTotalItems?: number | null;
  currentItem?: string | null;
  message: string;
}

type Clock = () => Date;

function createIdleSnapshot(
  timestamp: string,
): PlayStationSyncProgressSnapshot {
  return {
    status: "idle",
    operation: null,
    phase: "idle",
    completedItems: 0,
    totalItems: null,
    subtaskCompletedItems: null,
    subtaskTotalItems: null,
    currentItem: null,
    message: "No PlayStation synchronization is currently running.",
    startedAt: null,
    updatedAt: timestamp,
    finishedAt: null,
    errorMessage: null,
  };
}

export class PlayStationSyncProgressTracker {
  private snapshot: PlayStationSyncProgressSnapshot;

  constructor(private readonly clock: Clock = () => new Date()) {
    this.snapshot = createIdleSnapshot(this.timestamp());
  }

  getSnapshot(): PlayStationSyncProgressSnapshot {
    return { ...this.snapshot };
  }

  start(operation: PlayStationSyncOperation): void {
    const timestamp = this.timestamp();

    this.snapshot = {
      status: "running",
      operation,
      phase: "fetching_titles",
      completedItems: 0,
      totalItems: null,
      subtaskCompletedItems: null,
      subtaskTotalItems: null,
      currentItem: null,
      message: "Reading the trophy-title library from PlayStation.",
      startedAt: timestamp,
      updatedAt: timestamp,
      finishedAt: null,
      errorMessage: null,
    };
  }

  update(update: PlayStationSyncProgressUpdate): void {
    if (this.snapshot.status !== "running") {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      phase: update.phase,
      completedItems: update.completedItems,
      totalItems: update.totalItems,
      subtaskCompletedItems: update.subtaskCompletedItems ?? null,
      subtaskTotalItems: update.subtaskTotalItems ?? null,
      currentItem: update.currentItem ?? null,
      message: update.message,
      updatedAt: this.timestamp(),
    };
  }

  succeed(): void {
    if (this.snapshot.status !== "running") {
      return;
    }

    const timestamp = this.timestamp();

    this.snapshot = {
      ...this.snapshot,
      status: "succeeded",
      phase: "complete",
      completedItems: this.snapshot.totalItems ?? this.snapshot.completedItems,
      subtaskCompletedItems: null,
      subtaskTotalItems: null,
      currentItem: null,
      message: "PlayStation trophy synchronization completed.",
      updatedAt: timestamp,
      finishedAt: timestamp,
      errorMessage: null,
    };
  }

  fail(error: unknown): void {
    if (this.snapshot.status !== "running") {
      return;
    }

    const timestamp = this.timestamp();
    const errorMessage =
      error instanceof Error
        ? error.message
        : "The PlayStation synchronization stopped unexpectedly.";

    this.snapshot = {
      ...this.snapshot,
      status: "failed",
      phase: "failed",
      currentItem: null,
      message: "PlayStation trophy synchronization failed.",
      updatedAt: timestamp,
      finishedAt: timestamp,
      errorMessage,
    };
  }

  private timestamp(): string {
    return this.clock().toISOString();
  }
}
