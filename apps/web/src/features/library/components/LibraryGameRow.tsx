import { pursuitStatusLabels, type LibraryGame } from "../../../domain/libraryGame";

interface LibraryGameRowProps {
  readonly game: LibraryGame;
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

  return (
    <article className={`game-row${isArchived ? " game-row--archived" : ""}`}>
      <div className="game-row__order" aria-label={position === null ? "Archived" : `Position ${position}`}>
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
          <span className="trophy-placeholder">Trophies not synced</span>
        </div>

        {game.notes === null ? null : <p className="game-row__notes">{game.notes}</p>}
      </div>

      <div className="game-row__actions">
        <button className="text-button" type="button" disabled={busy} onClick={onEdit}>
          Edit
        </button>

        {isArchived ? (
          <button className="text-button" type="button" disabled={busy} onClick={onRestore}>
            Restore
          </button>
        ) : (
          <button className="text-button" type="button" disabled={busy} onClick={onArchive}>
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
