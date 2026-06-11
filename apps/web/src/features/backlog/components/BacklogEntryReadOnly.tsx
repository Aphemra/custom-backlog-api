import type { Bucket, GameEntry } from "../../../domain/backlog";
import { formatPlayStatus, formatTrophyStatus, getPlatformShortName } from "../../../domain/display";

interface BacklogEntryReadOnlyProps {
  game: GameEntry;
  buckets: Bucket[];
  onEdit: () => void;
}

export function BacklogEntryReadOnly({ game, buckets, onEdit }: BacklogEntryReadOnlyProps) {
  const platformLabels = game.platformIds.map(getPlatformShortName).join(" / ");

  const gameBuckets = buckets.filter((bucket) => game.bucketIds.includes(bucket.id));

  const bucketText = gameBuckets.length > 0 ? gameBuckets.map((bucket) => bucket.name).join(", ") : "No bucket assigned";

  const trophyProgress = game.trophyProgress;

  const completionText = trophyProgress.completionPercent !== undefined ? `${trophyProgress.completionPercent}%` : "Unknown";

  const trophyCountText =
    trophyProgress.earnedTrophies !== undefined && trophyProgress.totalTrophies !== undefined
      ? `${trophyProgress.earnedTrophies}/${trophyProgress.totalTrophies}`
      : "Unknown";

  return (
    <div className="backlog-entry-details">
      <div className="details-toolbar">
        <div>
          <h3>Game Details</h3>
          <p>Current backlog and trophy tracking information.</p>
        </div>

        <button className="button button--primary" type="button" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="details-grid">
        <DetailItem label="Play Status" value={formatPlayStatus(game.playStatus)} />
        <DetailItem label="Trophy Status" value={formatTrophyStatus(game.trophyStatus)} />
        <DetailItem label="Platforms" value={platformLabels} />
        <DetailItem label="Buckets" value={bucketText} />
        <DetailItem label="Completion" value={completionText} />
        <DetailItem label="Trophies" value={trophyCountText} />
        <DetailItem label="Platinum" value={trophyProgress.platinumEarned ? "Earned" : "Not earned"} />
        <DetailItem label="Rating" value={game.rating !== undefined ? `${game.rating}/10` : "Unrated"} />
      </div>

      <section className="details-section">
        <h3>Notes</h3>
        <p>{game.notes ?? "No notes added yet."}</p>
      </section>

      {trophyProgress.psnProfilesUrl ? (
        <a className="button details-link" href={trophyProgress.psnProfilesUrl} target="_blank" rel="noreferrer">
          Open on PSNProfiles
        </a>
      ) : null}
    </div>
  );
}

interface DetailItemProps {
  label: string;
  value: string;
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span className="detail-item__value">{value}</span>
    </div>
  );
}
