import type { CollectionSummary } from "../../../domain/collection";

interface CollectionCardProps {
  readonly collection: CollectionSummary;
  readonly position: number;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly busy: boolean;
  readonly managing: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onManage: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

export function CollectionCard({
  collection,
  position,
  canMoveUp,
  canMoveDown,
  busy,
  managing,
  onMoveUp,
  onMoveDown,
  onManage,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  return (
    <article
      className={`collection-card${managing ? " collection-card--active" : ""}`}
    >
      <div className="game-row__order" aria-label={`Position ${position}`}>
        <button
          className="order-button"
          type="button"
          disabled={busy || !canMoveUp}
          onClick={onMoveUp}
          aria-label={`Move ${collection.name} up`}
        >
          ↑
        </button>

        <span className="order-number">{position}</span>

        <button
          className="order-button"
          type="button"
          disabled={busy || !canMoveDown}
          onClick={onMoveDown}
          aria-label={`Move ${collection.name} down`}
        >
          ↓
        </button>
      </div>

      <div className="collection-card__content">
        <div className="collection-card__title-line">
          <h3>{collection.name}</h3>

          <span className="collection-count">
            {collection.gameCount}{" "}
            {collection.gameCount === 1 ? "game" : "games"}
          </span>
        </div>

        {collection.description === null ? null : (
          <p className="collection-card__description">
            {collection.description}
          </p>
        )}

        <div className="collection-card__counts">
          <span>{collection.activeGameCount} active</span>

          {collection.archivedGameCount > 0 ? (
            <span>{collection.archivedGameCount} archived</span>
          ) : null}

          <span className="trophy-placeholder">Trophy totals after sync</span>
        </div>
      </div>

      <div className="collection-card__actions">
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={onManage}
        >
          {managing ? "Close games" : "Manage games"}
        </button>

        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </button>

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
