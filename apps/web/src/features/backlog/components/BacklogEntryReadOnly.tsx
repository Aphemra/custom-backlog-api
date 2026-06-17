import type { Bucket, GameEntry } from "../../../domain/backlog";
import { formatShortDateTime } from "../../../domain/date";
import { formatPlayStatus, formatTrophyStatus, getPlatformShortName } from "../../../domain/display";
import { formatCompletionPercent, formatTrophyCount } from "../services/formatTrophyProgress";
import { RatingDisplay } from "./RatingDisplay";
import { TrophyProgressBar } from "./TrophyProgressBar";

interface BacklogEntryReadOnlyProps {
  game: GameEntry;
  buckets: Bucket[];
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function BacklogEntryReadOnly({ game, buckets, onEdit, onDelete, onMoveUp, onMoveDown }: BacklogEntryReadOnlyProps) {
  const platformLabels = game.platformIds.map(getPlatformShortName).join(" / ");

  const gameBuckets = buckets.filter((bucket) => game.bucketIds.includes(bucket.id));

  const bucketText = gameBuckets.length > 0 ? gameBuckets.map((bucket) => bucket.name).join(", ") : "No bucket assigned";

  const trophyProgress = game.trophyProgress;

  return (
    <div className="backlog-entry-details">
      <div className="details-toolbar">
        <div>
          <h3>Game Details</h3>
          <p>Current backlog and trophy tracking information.</p>
        </div>

        <div className="form-actions">
          <button className="button button--danger" type="button" onClick={onDelete}>
            Delete
          </button>

          <button className="button button--primary" type="button" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>

      <section className="details-highlight-card">
        <div>
          <span className="detail-item__label">Trophy Progress</span>
          <TrophyProgressBar trophyProgress={trophyProgress} />
        </div>

        <div className="details-highlight-card__stats">
          <DetailItem label="Completion" value={formatCompletionPercent(trophyProgress)} />
          <DetailItem label="Trophies" value={formatTrophyCount(trophyProgress)} />
          <DetailItem label="Platinum" value={trophyProgress.platinumEarned ? "Earned" : "Not earned"} />
        </div>
      </section>

      <div className="details-grid">
        <DetailItem label="Play Status" value={formatPlayStatus(game.playStatus)} />
        <DetailItem label="Trophy Status" value={formatTrophyStatus(game.trophyStatus)} />
        <DetailItem label="Platforms" value={platformLabels} />
        <DetailItem label="Buckets" value={bucketText} />
        <DetailItem label="Created" value={formatShortDateTime(game.createdAt)} />
        <DetailItem label="Last Updated" value={formatShortDateTime(game.updatedAt)} />
      </div>

      {game.externalMetadata?.igdb ? (
        <section className="details-section">
          <h3>External Metadata</h3>

          <div className="details-grid">
            <DetailItem label="Source" value={game.externalMetadata.igdb.source === "igdb" ? "IGDB" : "Mock IGDB"} />
            <DetailItem label="IGDB ID" value={game.externalMetadata.igdb.igdbId.toString()} />
            <DetailItem label="IGDB Name" value={game.externalMetadata.igdb.name} />
            <DetailItem label="Release Year" value={game.externalMetadata.igdb.firstReleaseYear?.toString() ?? "Unknown"} />
            <DetailItem
              label="IGDB Platforms"
              value={game.externalMetadata.igdb.platformNames.length > 0 ? game.externalMetadata.igdb.platformNames.join(" / ") : "Unknown"}
            />
            <DetailItem label="Imported" value={formatShortDateTime(game.externalMetadata.igdb.importedAt)} />
          </div>
        </section>
      ) : null}

      <section className="details-section">
        <h3>Rating</h3>
        <RatingDisplay rating={game.rating} />
      </section>

      <section className="details-section">
        <h3>Priority Order</h3>

        <div className="priority-actions">
          <p>
            Current main backlog priority: <strong>#{game.priorityOrder}</strong>
          </p>

          <div className="form-actions">
            <button className="button" type="button" onClick={onMoveUp}>
              Move Up
            </button>

            <button className="button" type="button" onClick={onMoveDown}>
              Move Down
            </button>
          </div>
        </div>
      </section>

      <section className="details-section">
        <h3>Notes</h3>
        <p>{game.notes ?? "No notes added yet."}</p>
      </section>

      {trophyProgress.psnProfilesUrl ? (
        <a className="button details-link" href={trophyProgress.psnProfilesUrl} target="_blank" rel="noreferrer">
          Open Trophy List on PSNProfiles
        </a>
      ) : (
        <p className="helper-text">No PSNProfiles link added yet.</p>
      )}
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
