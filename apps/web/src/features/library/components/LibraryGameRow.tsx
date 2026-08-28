import { useState, type ReactNode } from "react";
import {
  playStatusLabels,
  type LibraryGameListItem,
} from "../../../domain/libraryGame";
import { GameResourceLinks } from "./GameResourceLinks";

interface LibraryGameRowProps {
  readonly game: LibraryGameListItem;
  readonly position: number | null;
  readonly dragHandle: ReactNode | null;
  readonly busy: boolean;
  readonly onOpenDetails: () => void;
  readonly onEdit: () => void;
  readonly onHide: () => void;
  readonly onUnhide: () => void;
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
  dragHandle,
  busy,
  onOpenDetails,
  onEdit,
  onHide,
  onUnhide,
  onDelete,
}: LibraryGameRowProps) {
  const isHidden = game.hiddenAt !== null;

  const [failedImageId, setFailedImageId] = useState<string | null>(null);

  const trophySummary = game.trophySummary;

  const showArtwork =
    game.artwork !== null && failedImageId !== game.artwork.imageId;

  const earnedTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.earnedTrophies);

  const availableTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.totalTrophies);

  return (
    <article className={`game-row${isHidden ? " game-row--hidden" : ""}`}>
      <button
        className="game-row__details-surface"
        type="button"
        aria-label={`Open details for ${game.title}`}
        onClick={onOpenDetails}
      />

      <div
        className="game-row__order"
        aria-label={position === null ? "Hidden" : `Position ${position}`}
      >
        {isHidden || dragHandle === null ? (
          <span className="order-number">
            {position === null ? "—" : position}
          </span>
        ) : (
          <>
            {dragHandle}

            <span className="order-number">{position}</span>
          </>
        )}
      </div>

      <div
        className={`game-row__artwork${
          game.artwork?.role === "icon" ? " game-row__artwork--icon" : ""
        }`}
      >
        {showArtwork && game.artwork !== null ? (
          <img
            src={game.artwork.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedImageId(game.artwork?.imageId ?? null)}
          />
        ) : (
          <span aria-hidden="true">
            {game.title.trim().charAt(0).toLocaleUpperCase("en-US")}
          </span>
        )}
      </div>

      <div className="game-row__content">
        <div className="game-row__title-line">
          <h3>{game.title}</h3>
          <span className="platform-badge">{game.platform}</span>
          {isHidden ? <span className="hidden-badge">Hidden</span> : null}
        </div>

        <div className="game-row__meta">
          <span className={`status-label status-label--${game.playStatus}`}>
            {playStatusLabels[game.playStatus]}
          </span>
          {game.isUnobtainable ? (
            <span className="status-label status-label--unobtainable">
              Unobtainable
            </span>
          ) : null}
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

        <GameResourceLinks gameTitle={game.title} resources={game.resources} />

        {game.notes === null ? null : (
          <p className="game-row__notes">{game.notes}</p>
        )}
      </div>

      <div
        className="game-row__actions"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={onEdit}
        >
          Edit
        </button>

        {isHidden ? (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={onUnhide}
          >
            Unhide
          </button>
        ) : (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={onHide}
          >
            Hide
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
