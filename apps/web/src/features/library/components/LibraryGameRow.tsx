import {
  pursuitStatusLabels,
  type LibraryGameWithTrophySummary,
} from "../../../domain/libraryGame";

interface LibraryGameRowProps {
  readonly game: LibraryGameWithTrophySummary;
  readonly position: number | null;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly orderingDisabled: boolean;
  readonly busy: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
}

function totalTrophies(counts: {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function formatSyncDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function LibraryGameRow({
  game,
  position,
  canMoveUp,
  canMoveDown,
  orderingDisabled,
  busy,
  onMoveUp,
  onMoveDown,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: LibraryGameRowProps) {
  const isArchived = game.archivedAt !== null;

  const trophySummary = game.trophySummary;

  const earnedTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.earnedTrophies);

  const availableTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.totalTrophies);

  return (
    <article className={`game-row${isArchived ? " game-row--archived" : ""}`}>
      <div
        className="game-row__order"
        aria-label={position === null ? "Archived" : `Position ${position}`}
      >
        {isArchived ? (
          <span className="order-number">—</span>
        ) : (
          <>
            <button
              className="order-button"
              type="button"
              disabled={busy || orderingDisabled || !canMoveUp}
              onClick={onMoveUp}
              aria-label={`Move ${game.title} up`}
            >
              ↑
            </button>
            <span className="order-number">{position}</span>
            <button
              className="order-button"
              type="button"
              disabled={busy || orderingDisabled || !canMoveDown}
              onClick={onMoveDown}
              aria-label={`Move ${game.title} down`}
            >
              ↓
            </button>
          </>
        )}
      </div>

      <div className="game-row__content">
        <div className="game-row__title-line">
          <h3>{game.title}</h3>
          <span className="platform-badge">{game.platform}</span>
          {isArchived ? <span className="archive-badge">Archived</span> : null}
        </div>

        <div className="game-row__meta">
          <span className={`status-label status-label--${game.pursuitStatus}`}>
            {pursuitStatusLabels[game.pursuitStatus]}
          </span>
          {trophySummary === null ? (
            <span className="trophy-placeholder">No trophy snapshot</span>
          ) : (
            <>
              <span className="trophy-progress">
                <strong>{trophySummary.progressPercent}%</strong>
                <span>
                  {earnedTrophyCount} / {availableTrophyCount} trophies
                </span>
              </span>

              {trophySummary.platinumEarned ? (
                <span className="trophy-badge trophy-badge--platinum">
                  Platinum
                </span>
              ) : null}

              {trophySummary.is100Percent && !trophySummary.platinumEarned ? (
                <span className="trophy-badge trophy-badge--complete">
                  100%
                </span>
              ) : null}

              <span
                className="trophy-sync-time"
                title={new Date(trophySummary.lastSyncedAt).toLocaleString()}
              >
                Synced {formatSyncDate(trophySummary.lastSyncedAt)}
              </span>
            </>
          )}
        </div>

        {game.notes === null ? null : (
          <p className="game-row__notes">{game.notes}</p>
        )}
      </div>

      <div className="game-row__actions">
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </button>

        {isArchived ? (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={onRestore}
          >
            Restore
          </button>
        ) : (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={onArchive}
          >
            Archive
          </button>
        )}

        <button
          className="text-button text-button--danger"
          type="button"
          disabled={busy}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
