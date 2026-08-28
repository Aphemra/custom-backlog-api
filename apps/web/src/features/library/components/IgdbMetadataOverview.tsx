import type { ReactNode } from "react";
import type { IgdbGameSearchResult } from "../../../domain/igdb";
import type {
  LibraryGameDetailsImage,
  LibraryGameIgdbDetails,
} from "../../../domain/libraryGameDetails";

type IgdbMetadata = LibraryGameIgdbDetails | IgdbGameSearchResult;

interface OverviewImage {
  readonly imageId: string;
  readonly url: string;
}

interface IgdbMetadataOverviewProps {
  readonly title: string;
  readonly metadata: IgdbMetadata | null;
  readonly fallbackCover?: OverviewImage | null;
  readonly badges?: ReactNode;
  readonly actions?: ReactNode;
  readonly showTitle?: boolean;
}

function formatReleaseDate(value: string | null): string {
  if (value === null) {
    return "Release date unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function formatTimeEstimate(seconds: number | null): string | null {
  if (seconds === null) {
    return null;
  }

  const hours = seconds / 3600;

  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours`;
}

function formatRating(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `${Math.round(value)} / 100`;
}

function joinNames(
  values: readonly {
    readonly name: string;
  }[],
): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.map((value) => value.name).join(", ");
}

function metadataCover(metadata: IgdbMetadata | null): OverviewImage | null {
  if (metadata === null) {
    return null;
  }

  if ("images" in metadata) {
    return metadata.images.cover;
  }

  return metadata.cover;
}

function metadataScreenshots(
  metadata: IgdbMetadata,
): readonly LibraryGameDetailsImage[] {
  if ("images" in metadata) {
    return metadata.images.screenshots;
  }

  return metadata.screenshots.map((screenshot) => ({
    imageId: screenshot.imageId,
    url: `/api/images/${encodeURIComponent(screenshot.imageId)}`,
    width: screenshot.width,
    height: screenshot.height,
  }));
}

function DetailField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  if (value === null) {
    return null;
  }

  return (
    <div className="game-details__field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OverviewCover({
  image,
  title,
}: {
  readonly image: OverviewImage | null;
  readonly title: string;
}) {
  if (image === null) {
    return (
      <div className="game-details__cover game-details__cover--placeholder">
        {title.trim().charAt(0).toLocaleUpperCase("en-US")}
      </div>
    );
  }

  return (
    <img
      className="game-details__cover"
      src={image.url}
      alt={`${title} cover`}
    />
  );
}

export function IgdbMetadataOverview({
  title,
  metadata,
  fallbackCover = null,
  badges,
  actions,
  showTitle = true,
}: IgdbMetadataOverviewProps) {
  const developers =
    metadata?.companies.filter((company) => company.developer) ?? [];

  const publishers =
    metadata?.companies.filter((company) => company.publisher) ?? [];

  const cover = metadataCover(metadata) ?? fallbackCover;

  const screenshots = metadata === null ? [] : metadataScreenshots(metadata);

  return (
    <>
      <section className="game-details__hero">
        <div className="game-details__cover-column">
          <OverviewCover image={cover} title={title} />

          {actions}
        </div>

        <div className="game-details__hero-content">
          {showTitle ? (
            <h3 className="game-details__overview-title">{title}</h3>
          ) : null}

          {badges === undefined ? null : (
            <div className="game-details__status-line">{badges}</div>
          )}

          {metadata === null ? (
            <p className="game-details__summary">
              This game does not currently have connected IGDB metadata.
            </p>
          ) : (
            <>
              <p className="game-details__summary">
                {metadata.summary ??
                  "IGDB does not currently provide a summary for this game."}
              </p>

              <dl className="game-details__metadata-grid">
                <DetailField
                  label="Release"
                  value={formatReleaseDate(metadata.releaseDate)}
                />

                <DetailField label="Developer" value={joinNames(developers)} />

                <DetailField label="Publisher" value={joinNames(publishers)} />

                <DetailField
                  label="Type"
                  value={metadata.gameType.name ?? "Game"}
                />

                <DetailField
                  label="Rating"
                  value={formatRating(metadata.totalRating)}
                />

                <DetailField
                  label="Modes"
                  value={joinNames(metadata.gameModes)}
                />
              </dl>
            </>
          )}
        </div>
      </section>

      {metadata === null ? null : (
        <>
          {metadata.genres.length === 0 &&
          metadata.collections.length === 0 &&
          metadata.franchises.length === 0 ? null : (
            <section className="game-details__section">
              <div className="game-details__section-heading">
                <div>
                  <p className="eyebrow">Classification</p>
                  <h3>Genres and series</h3>
                </div>
              </div>

              <div className="game-details__tags">
                {metadata.genres.map((genre) => (
                  <span key={`genre:${genre.externalId}`}>{genre.name}</span>
                ))}

                {metadata.collections.map((collection) => (
                  <span key={`collection:${collection.externalId}`}>
                    {collection.name}
                  </span>
                ))}

                {metadata.franchises.map((franchise) => (
                  <span key={`franchise:${franchise.externalId}`}>
                    {franchise.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {metadata.timeToBeat === null ? null : (
            <section className="game-details__section">
              <div className="game-details__section-heading">
                <div>
                  <p className="eyebrow">IGDB estimates</p>
                  <h3>Time to beat</h3>
                </div>
              </div>

              <div className="game-details__time-grid">
                {formatTimeEstimate(metadata.timeToBeat.hastilySeconds) ===
                null ? null : (
                  <div>
                    <strong>
                      {formatTimeEstimate(metadata.timeToBeat.hastilySeconds)}
                    </strong>
                    <span>Rushed</span>
                  </div>
                )}

                {formatTimeEstimate(metadata.timeToBeat.normallySeconds) ===
                null ? null : (
                  <div>
                    <strong>
                      {formatTimeEstimate(metadata.timeToBeat.normallySeconds)}
                    </strong>
                    <span>Main experience</span>
                  </div>
                )}

                {formatTimeEstimate(metadata.timeToBeat.completelySeconds) ===
                null ? null : (
                  <div>
                    <strong>
                      {formatTimeEstimate(
                        metadata.timeToBeat.completelySeconds,
                      )}
                    </strong>
                    <span>Completionist</span>
                  </div>
                )}
              </div>

              {metadata.timeToBeat.submissionCount > 0 ? (
                <p className="game-details__source-note">
                  Based on{" "}
                  {metadata.timeToBeat.submissionCount.toLocaleString()} IGDB
                  submissions.
                </p>
              ) : null}
            </section>
          )}

          {metadata.storyline === null ? null : (
            <section className="game-details__section">
              <div className="game-details__section-heading">
                <div>
                  <p className="eyebrow">Story</p>
                  <h3>Storyline</h3>
                </div>
              </div>

              <p className="game-details__long-copy">{metadata.storyline}</p>
            </section>
          )}

          {screenshots.length === 0 ? null : (
            <section className="game-details__section">
              <div className="game-details__section-heading">
                <div>
                  <p className="eyebrow">Cached media</p>
                  <h3>Screenshots</h3>
                </div>

                <span>{screenshots.length}</span>
              </div>

              <div className="game-details__gallery">
                {screenshots.map((screenshot, index) => (
                  <img
                    key={screenshot.imageId}
                    src={screenshot.url}
                    alt={`${title} screenshot ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
