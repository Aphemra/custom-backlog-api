import type { ReactNode } from "react";
import { IconButton } from "../../../components/ui/IconButton";
import {
  DeleteIcon,
  EditIcon,
  GameListIcon,
  TrophyIcon,
} from "../../../components/ui/icons";
import type { CollectionSummary } from "../../../domain/collection";
import type { PlayStationTrophyCounts } from "../../../domain/playStation";

interface CollectionCardProps {
  readonly collection: CollectionSummary;
  readonly position: number;
  readonly dragHandle: ReactNode;
  readonly busy: boolean;
  readonly managing: boolean;
  readonly onManage: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function totalTrophies(counts: PlayStationTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function formatTimeEstimate(seconds: number): string {
  const hours = seconds / 3_600;

  if (hours < 10) {
    return `${hours.toFixed(1)} hours`;
  }

  return `${formatNumber(Math.round(hours))} hours`;
}

export function CollectionCard({
  collection,
  position,
  dragHandle,
  busy,
  managing,
  onManage,
  onEdit,
  onDelete,
}: CollectionCardProps) {
  const trophySummary = collection.trophySummary;
  const completionistEstimate =
    collection.timeEstimateSummary?.completely ?? null;

  const earnedTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.earnedTrophies);

  const totalTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.totalTrophies);

  const hasCompletionistEstimate =
    completionistEstimate !== null && completionistEstimate.gameCount > 0;

  return (
    <article
      className={`collection-card${managing ? " collection-card--active" : ""}`}
    >
      <div
        className="collection-card__order"
        aria-label={`Position ${position}`}
      >
        {dragHandle}

        <span className="order-number">{position}</span>
      </div>

      <div className="collection-card__content">
        <div className="collection-card__title-line">
          <h3>{collection.name}</h3>

          <span className="collection-count">
            {collection.gameCount}{" "}
            {collection.gameCount === 1 ? "game" : "games"}
          </span>
        </div>

        <p
          className={`collection-card__description${
            collection.description === null
              ? " collection-card__description--empty"
              : ""
          }`}
        >
          {collection.description ?? "No description"}
        </p>

        <div className="collection-card__membership">
          <span>{collection.visibleGameCount} visible</span>

          {collection.hiddenGameCount === 0 ? null : (
            <span>{collection.hiddenGameCount} hidden</span>
          )}
        </div>

        <div className="collection-card__metrics">
          {trophySummary === null ? (
            <div className="collection-card__metric">
              <strong>—</strong>
              <span>No synced trophy data</span>
            </div>
          ) : (
            <>
              <div className="collection-card__metric">
                <strong className="collection-card__metric-with-icon">
                  <TrophyIcon />

                  <span>
                    {formatNumber(earnedTrophyCount)} /{" "}
                    {formatNumber(totalTrophyCount)}
                  </span>
                </strong>

                <span>Trophies earned</span>
              </div>

              <div className="collection-card__metric">
                <strong>
                  {trophySummary.completedGameCount} /{" "}
                  {trophySummary.gameCountWithTrophies}
                </strong>

                <span>Games at 100%</span>
              </div>

              <div className="collection-card__metric">
                <strong>{formatNumber(trophySummary.points.remaining)}</strong>

                <span>Points remaining</span>
              </div>
            </>
          )}

          {hasCompletionistEstimate ? (
            <div className="collection-card__metric">
              <strong>
                {formatTimeEstimate(completionistEstimate.totalSeconds)}
              </strong>

              <span>
                Completionist · {completionistEstimate.gameCount}/
                {collection.gameCount} games
              </span>
            </div>
          ) : (
            <div className="collection-card__metric">
              <strong>—</strong>

              <span>No completion-time estimate</span>
            </div>
          )}
        </div>
      </div>

      <div className="collection-card__actions">
        <IconButton
          label={`${managing ? "Close game manager for" : "Manage games in"} ${
            collection.name
          }`}
          tooltip={managing ? "Close game manager" : "Manage games"}
          icon={<GameListIcon />}
          disabled={busy}
          aria-pressed={managing}
          onClick={onManage}
        />

        <IconButton
          label={`Edit ${collection.name}`}
          tooltip="Edit Collection"
          icon={<EditIcon />}
          disabled={busy}
          onClick={onEdit}
        />

        <IconButton
          label={`Delete ${collection.name}`}
          tooltip="Delete Collection"
          icon={<DeleteIcon />}
          tone="danger"
          disabled={busy}
          onClick={onDelete}
        />
      </div>
    </article>
  );
}
