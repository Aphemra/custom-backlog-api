import { useState, type CSSProperties, type MouseEvent, type TransitionEvent } from "react";
import type { Bucket, GameEntry, PlayStatus } from "../../../domain/backlog";
import { formatPlayStatus, formatTrophyStatus, getPlatformShortName } from "../../../domain/display";
import type { TrophyStatus } from "../../../domain/trophy";
import { formatCompletionPercent, formatTrophyCount } from "../services/formatTrophyProgress";
import { useBacklogStore } from "../store/useBacklogStore";
import { BacklogEntryDetails } from "./BacklogEntryDetails";
import { TrophyProgressBar } from "./TrophyProgressBar";

const playStatusOptions: PlayStatus[] = ["backlog", "playing", "beaten", "completed", "shelved", "abandoned"];

const trophyStatusOptions: TrophyStatus[] = [
  "not_started",
  "started",
  "cleanup",
  "platinumed",
  "hundred_percent",
  "skipped",
  "unobtainable",
  "not_applicable",
];

const ratingOptions = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0];

interface BacklogRowProps {
  game: GameEntry;
  buckets: Bucket[];
  isOpen: boolean;
  onToggle: () => void;
}

export function BacklogRow({ game, buckets, isOpen, onToggle }: BacklogRowProps) {
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);
  const [shouldRenderDetails, setShouldRenderDetails] = useState(isOpen);

  function handleToggle() {
    if (!isOpen) {
      setShouldRenderDetails(true);
    }

    onToggle();
  }

  function handleDetailsTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.propertyName !== "max-height") {
      return;
    }

    if (!isOpen) {
      setShouldRenderDetails(false);
    }
  }

  const platformLabels = game.platformIds.map(getPlatformShortName);
  const gameBuckets = buckets.filter((bucket) => game.bucketIds.includes(bucket.id));
  const coverUrl = game.externalMetadata?.igdb?.coverUrl;
  const psnProfilesUrl = game.trophyProgress.psnProfilesUrl;

  const rowStyle = coverUrl
    ? ({
        "--backlog-row-cover-url": `url("${coverUrl}")`,
      } as CSSProperties)
    : undefined;

  function handlePlayStatusChange(nextPlayStatus: PlayStatus) {
    updateGameEntry(game.id, {
      playStatus: nextPlayStatus,
    });
  }

  function handleTrophyStatusChange(nextTrophyStatus: TrophyStatus) {
    updateGameEntry(game.id, {
      trophyStatus: nextTrophyStatus,
    });
  }

  function handleRatingChange(value: string) {
    if (!value) {
      return;
    }

    updateGameEntry(game.id, {
      rating: Number(value),
    });
  }

  function stopRowActionPropagation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <article className={`backlog-row ${isOpen ? "backlog-row--open" : ""} ${coverUrl ? "backlog-row--with-cover" : ""}`} style={rowStyle}>
      <div className="backlog-row__summary">
        <div className="backlog-row__priority">#{game.priorityOrder}</div>

        <div className="backlog-row__main">
          <div className="backlog-row__title-line">
            <button className="backlog-row__title-button" type="button" onClick={handleToggle} aria-expanded={isOpen}>
              <h2>{game.title}</h2>
            </button>

            <div className="backlog-row__platforms" aria-label="Platforms">
              {platformLabels.map((platformLabel) => (
                <span className="platform-pill" key={platformLabel}>
                  {platformLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="backlog-row__chip-line" aria-label="Backlog metadata">
            <label className="quick-edit-control" onClick={stopRowActionPropagation}>
              <span>Play</span>
              <select value={game.playStatus} onChange={(event) => handlePlayStatusChange(event.target.value as PlayStatus)}>
                {playStatusOptions.map((status) => (
                  <option value={status} key={status}>
                    {formatPlayStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            <label className="quick-edit-control" onClick={stopRowActionPropagation}>
              <span>Trophy</span>
              <select value={game.trophyStatus} onChange={(event) => handleTrophyStatusChange(event.target.value as TrophyStatus)}>
                {trophyStatusOptions.map((status) => (
                  <option value={status} key={status}>
                    {formatTrophyStatus(status)}
                  </option>
                ))}
              </select>
            </label>

            {gameBuckets.length > 0 ? (
              gameBuckets.slice(0, 3).map((bucket) => (
                <span className="bucket-chip" key={bucket.id}>
                  {bucket.name}
                </span>
              ))
            ) : (
              <span className="bucket-chip bucket-chip--empty">No Bucket</span>
            )}

            {gameBuckets.length > 3 ? <span className="bucket-chip">+{gameBuckets.length - 3}</span> : null}
          </div>

          {game.notes ? <p className="backlog-row__note-preview">{game.notes}</p> : null}

          <div className="backlog-row__progress-line">
            <TrophyProgressBar trophyProgress={game.trophyProgress} className="trophy-progress--row" />

            <span className="backlog-row__trophy-count">
              {formatTrophyCount(game.trophyProgress)} trophies · {formatCompletionPercent(game.trophyProgress)}
            </span>
          </div>
        </div>

        <div className="backlog-row__actions" onClick={stopRowActionPropagation}>
          <label className="rating-quick-edit">
            <span>Rating</span>
            <select
              value={game.rating?.toString() ?? ""}
              onChange={(event) => handleRatingChange(event.target.value)}
              aria-label={`Rating for ${game.title}`}
            >
              <option value="" disabled>
                —
              </option>

              {ratingOptions.map((rating) => (
                <option value={rating} key={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </label>

          {psnProfilesUrl ? (
            <a
              className="icon-button"
              href={psnProfilesUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${game.title} on PSNProfiles`}
              title="Open PSNProfiles"
            >
              P
            </a>
          ) : (
            <button
              className="icon-button icon-button--disabled"
              type="button"
              disabled
              aria-label={`${game.title} has no PSNProfiles link`}
              title="No PSNProfiles link"
            >
              P
            </button>
          )}

          <button
            className="backlog-row__chevron"
            type="button"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse game details" : "Expand game details"}
          >
            {isOpen ? "−" : "+"}
          </button>
        </div>
      </div>

      <div
        className={`backlog-row__details-shell ${isOpen ? "backlog-row__details-shell--open" : ""}`}
        aria-hidden={!isOpen}
        onTransitionEnd={handleDetailsTransitionEnd}
      >
        {shouldRenderDetails ? <BacklogEntryDetails game={game} buckets={buckets} /> : null}
      </div>
    </article>
  );
}
