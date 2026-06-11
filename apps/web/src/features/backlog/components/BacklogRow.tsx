import type { Bucket, GameEntry } from "../../../domain/backlog";
import { formatPlayStatus, formatTrophyStatus, getPlatformShortName } from "../../../domain/display";
import { BacklogEntryDetails } from "./BacklogEntryDetails";

interface BacklogRowProps {
  game: GameEntry;
  buckets: Bucket[];
  isOpen: boolean;
  onToggle: () => void;
}

export function BacklogRow({ game, buckets, isOpen, onToggle }: BacklogRowProps) {
  const platformLabels = game.platformIds.map(getPlatformShortName).join(" / ");

  const primaryBucket = buckets.find((bucket) => game.bucketIds.includes(bucket.id));

  const trophyText =
    game.trophyProgress.earnedTrophies !== undefined && game.trophyProgress.totalTrophies !== undefined
      ? `${game.trophyProgress.earnedTrophies}/${game.trophyProgress.totalTrophies} trophies`
      : "Trophy count unknown";

  const completionText = game.trophyProgress.completionPercent !== undefined ? `${game.trophyProgress.completionPercent}%` : "Progress unknown";

  return (
    <article className={`backlog-row ${isOpen ? "backlog-row--open" : ""}`}>
      <button className="backlog-row__summary" type="button" onClick={onToggle} aria-expanded={isOpen}>
        <div className="backlog-row__priority">#{game.priorityOrder}</div>

        <div className="backlog-row__main">
          <div className="backlog-row__title-line">
            <h2>{game.title}</h2>
            <span className="platform-pill">{platformLabels}</span>
          </div>

          <div className="backlog-row__meta">
            <span>{formatPlayStatus(game.playStatus)}</span>
            <span>{formatTrophyStatus(game.trophyStatus)}</span>
            <span>{completionText}</span>
            <span>{trophyText}</span>
            {primaryBucket ? <span>{primaryBucket.name}</span> : null}
          </div>
        </div>

        <span className="backlog-row__chevron" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? <BacklogEntryDetails game={game} buckets={buckets} /> : null}
    </article>
  );
}
