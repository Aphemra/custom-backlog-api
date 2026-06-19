import { useState } from "react";
import type { Bucket, GameEntry } from "../../../domain/backlog";
import { formatShortDateTime } from "../../../domain/date";
import { formatPlayStatus, formatTrophyStatus, getPlatformShortName } from "../../../domain/display";
import { formatCompletionPercent, formatTrophyCount } from "../services/formatTrophyProgress";
import { CollapsibleDetailsSection } from "./CollapsibleDetailsSection";
import { MetadataLinkPanel } from "./MetadataLinkPanel";
import { TrophySyncPreviewPanel } from "./TrophySyncPreviewPanel";

interface BacklogEntryReadOnlyProps {
  game: GameEntry;
  buckets: Bucket[];
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function BacklogEntryReadOnly({ game, buckets, onEdit, onDelete, onMoveUp, onMoveDown }: BacklogEntryReadOnlyProps) {
  const [isMetadataLinkPanelOpen, setIsMetadataLinkPanelOpen] = useState(false);

  const platformLabels = game.platformIds.map(getPlatformShortName).join(" / ");
  const gameBuckets = buckets.filter((bucket) => game.bucketIds.includes(bucket.id));
  const bucketText = gameBuckets.length > 0 ? gameBuckets.map((bucket) => bucket.name).join(", ") : "No bucket assigned";
  const trophyProgress = game.trophyProgress;

  return (
    <div className="backlog-entry-details">
      <section className="details-section details-section--management">
        <div className="details-toolbar">
          <div>
            <h3>Manage Entry</h3>
            <p>Edit full details, adjust priority, or remove this backlog entry.</p>
          </div>

          <div className="form-actions">
            <button className="button" type="button" onClick={onMoveUp}>
              Move Up
            </button>

            <button className="button" type="button" onClick={onMoveDown}>
              Move Down
            </button>

            <button className="button button--danger" type="button" onClick={onDelete}>
              Delete
            </button>

            <button className="button button--primary" type="button" onClick={onEdit}>
              Edit Full Details
            </button>
          </div>
        </div>
      </section>

      <CollapsibleDetailsSection title="Core Info" summary="Status, platforms, buckets, timestamps" defaultOpen>
        <div className="details-grid">
          <DetailItem label="Play Status" value={formatPlayStatus(game.playStatus)} />
          <DetailItem label="Trophy Status" value={formatTrophyStatus(game.trophyStatus)} />
          <DetailItem label="Platforms" value={platformLabels} />
          <DetailItem label="Buckets" value={bucketText} />
          <DetailItem label="Rating" value={game.rating !== undefined ? `${game.rating}/10` : "Unrated"} />
          <DetailItem label="Priority" value={`#${game.priorityOrder}`} />
          <DetailItem label="Completion" value={formatCompletionPercent(trophyProgress)} />
          <DetailItem label="Trophies" value={formatTrophyCount(trophyProgress)} />
          <DetailItem label="Platinum" value={trophyProgress.platinumEarned ? "Earned" : "Not earned"} />
          <DetailItem label="Created" value={formatShortDateTime(game.createdAt)} />
          <DetailItem label="Last Updated" value={formatShortDateTime(game.updatedAt)} />
          {game.trophyProgress.lastSyncedAt ? (
            <DetailItem label="Last PSNP Sync" value={formatShortDateTime(game.trophyProgress.lastSyncedAt)} />
          ) : null}
        </div>
      </CollapsibleDetailsSection>

      <CollapsibleDetailsSection title="Notes" summary={game.notes ? "View full note text" : "No notes added"}>
        <p>{game.notes ?? "No notes added yet."}</p>
      </CollapsibleDetailsSection>

      <CollapsibleDetailsSection
        title="Metadata & Links"
        summary={game.externalMetadata?.igdb ? `Linked to ${getMetadataSourceLabel(game.externalMetadata.igdb.source)}` : "No IGDB metadata linked"}
      >
        <div className="metadata-link-section">
          <div className="metadata-link-header">
            <div>
              <h3>Metadata Link</h3>

              <p className="helper-text">
                {game.externalMetadata?.igdb
                  ? `Linked to ${getMetadataSourceLabel(game.externalMetadata.igdb.source)}: ${game.externalMetadata.igdb.name}`
                  : "No IGDB metadata is linked to this backlog entry yet."}
              </p>
            </div>

            <button className="button" type="button" onClick={() => setIsMetadataLinkPanelOpen((currentValue) => !currentValue)}>
              {isMetadataLinkPanelOpen ? "Close Metadata Search" : game.externalMetadata?.igdb ? "Refresh Metadata" : "Link Metadata"}
            </button>
          </div>

          {isMetadataLinkPanelOpen ? <MetadataLinkPanel game={game} onLinked={() => setIsMetadataLinkPanelOpen(false)} /> : null}
        </div>

        {game.externalMetadata?.igdb ? (
          <section className="details-section details-section--nested">
            <h3>External Metadata</h3>

            {game.externalMetadata.igdb.coverUrl ? (
              <img
                className="external-metadata-cover"
                src={game.externalMetadata.igdb.coverUrl}
                alt={`Cover for ${game.externalMetadata.igdb.name}`}
              />
            ) : null}

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

        {trophyProgress.psnProfilesUrl ? (
          <a className="button details-link" href={trophyProgress.psnProfilesUrl} target="_blank" rel="noreferrer">
            Open Trophy List on PSNProfiles
          </a>
        ) : (
          <p className="helper-text">No PSNProfiles link added yet.</p>
        )}
      </CollapsibleDetailsSection>

      <CollapsibleDetailsSection title="Manual Trophy Sync" summary="Fallback manual PSNProfiles preview tool">
        <TrophySyncPreviewPanel game={game} />
      </CollapsibleDetailsSection>
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

function getMetadataSourceLabel(source: "mock" | "igdb" | undefined): string {
  return source === "igdb" ? "IGDB" : "Mock IGDB";
}
