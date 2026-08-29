import type { PlayStationSyncProgress } from "../../../domain/playStation";

interface PlayStationSyncProgressPanelProps {
  progress: PlayStationSyncProgress | null;
}

const phaseLabels: Readonly<Record<PlayStationSyncProgress["phase"], string>> =
  {
    idle: "Waiting",
    fetching_titles: "Reading trophy titles",
    fetching_trophies: "Fetching trophy details",
    caching_artwork: "Caching trophy artwork",
    saving_snapshots: "Saving trophy progress",
    refreshing_metadata: "Refreshing IGDB metadata",
    complete: "Complete",
    failed: "Failed",
  };

function formatElapsed(startedAt: string | null): string | null {
  if (startedAt === null) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(startedAt)) / 1_000),
  );
  const hours = Math.floor(elapsedSeconds / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function PlayStationSyncProgressPanel({
  progress,
}: PlayStationSyncProgressPanelProps) {
  if (
    progress === null ||
    (progress.status !== "running" && progress.status !== "failed")
  ) {
    return null;
  }

  const hasPrimaryTotal =
    progress.totalItems !== null && progress.totalItems > 0;
  const hasSubtaskTotal =
    progress.subtaskCompletedItems !== null &&
    progress.subtaskTotalItems !== null &&
    progress.subtaskTotalItems > 0;
  const elapsed = formatElapsed(progress.startedAt);
  const primaryUnitLabel =
    progress.phase === "refreshing_metadata" ? "IGDB games" : "Titles";

  return (
    <section
      className={`psn-sync-progress psn-sync-progress--${progress.status}`}
      aria-live="polite"
      aria-busy={progress.status === "running"}
    >
      <div className="psn-sync-progress__heading">
        <div>
          <p className="eyebrow">
            {progress.operation === "full"
              ? "PSN trophy import"
              : "Trophy progress refresh"}
          </p>

          <h3>{phaseLabels[progress.phase]}</h3>
        </div>

        <span className={`psn-sync-status psn-sync-status--${progress.status}`}>
          {progress.status === "running" ? "Running" : "Failed"}
        </span>
      </div>

      <p className="psn-sync-progress__message">{progress.message}</p>

      {progress.currentItem === null ? null : (
        <p className="psn-sync-progress__current">{progress.currentItem}</p>
      )}

      {hasPrimaryTotal ? (
        <div className="psn-sync-progress__meter">
          <div>
            <span>{primaryUnitLabel}</span>
            <strong>
              {progress.completedItems} / {progress.totalItems}
            </strong>
          </div>

          <progress
            max={progress.totalItems ?? 1}
            value={progress.completedItems}
          />
        </div>
      ) : null}

      {hasSubtaskTotal ? (
        <div className="psn-sync-progress__meter">
          <div>
            <span>Artwork for current title</span>
            <strong>
              {progress.subtaskCompletedItems} / {progress.subtaskTotalItems}
            </strong>
          </div>

          <progress
            max={progress.subtaskTotalItems ?? 1}
            value={progress.subtaskCompletedItems ?? 0}
          />
        </div>
      ) : null}

      {progress.status === "failed" && progress.errorMessage !== null ? (
        <p className="psn-sync-progress__error">{progress.errorMessage}</p>
      ) : null}

      {elapsed === null ? null : (
        <p className="psn-sync-progress__elapsed">Elapsed: {elapsed}</p>
      )}
    </section>
  );
}
