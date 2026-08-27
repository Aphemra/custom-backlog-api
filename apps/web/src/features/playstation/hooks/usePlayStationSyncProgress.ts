import { useCallback, useEffect, useState } from "react";
import type { PlayStationSyncProgress } from "../../../domain/playStation";
import { playStationApi } from "../../../services/api/playStationApi";

const RUNNING_POLL_INTERVAL_MS = 750;
const IDLE_POLL_INTERVAL_MS = 5_000;

export function usePlayStationSyncProgress(requestActive: boolean) {
  const [syncProgress, setSyncProgress] =
    useState<PlayStationSyncProgress | null>(null);

  const refreshSyncProgress = useCallback(async () => {
    const progress = await playStationApi.getSyncProgress();

    setSyncProgress(progress);

    return progress;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    async function poll(): Promise<void> {
      let nextDelay: number;

      try {
        const progress = await playStationApi.getSyncProgress();

        if (cancelled) {
          return;
        }

        setSyncProgress(progress);
        nextDelay =
          progress.status === "running" || requestActive
            ? RUNNING_POLL_INTERVAL_MS
            : IDLE_POLL_INTERVAL_MS;
      } catch {
        if (!cancelled) {
          setSyncProgress((currentProgress) => {
            if (currentProgress?.status !== "running") {
              return currentProgress;
            }

            const timestamp = new Date().toISOString();

            return {
              ...currentProgress,
              status: "failed",
              phase: "failed",
              message: "Lost contact with the local synchronization service.",
              updatedAt: timestamp,
              finishedAt: timestamp,
              errorMessage:
                "The local API stopped responding. Restart the app before trying again.",
            };
          });
        }

        nextDelay = requestActive
          ? RUNNING_POLL_INTERVAL_MS
          : IDLE_POLL_INTERVAL_MS;
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(() => void poll(), nextDelay);
      }
    }

    void poll();

    return () => {
      cancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [requestActive]);

  return {
    syncProgress,
    refreshSyncProgress,
  };
}
