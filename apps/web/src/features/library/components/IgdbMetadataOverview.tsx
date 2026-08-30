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

interface TimeEstimate {
  readonly label: string;
  readonly value: string;
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
  const formattedHours =
    hours < 10 ? hours.toFixed(1) : Math.round(hours).toString();

  return `${formattedHours}h`;
}

function createTimeEstimate(
  label: string,
  seconds: number | null,
): readonly TimeEstimate[] {
  const value = formatTimeEstimate(seconds);

  return value === null ? [] : [{ label, value }];
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

function uniqueNames(
  values: readonly {
    readonly name: string;
  }[],
): readonly string[] {
  const seenNames = new Set<string>();

  return values.flatMap((value) => {
    const normalizedName = value.name.trim().toLocaleLowerCase("en-US");

    if (normalizedName.length === 0 || seenNames.has(normalizedName)) {
      return [];
    }

    seenNames.add(normalizedName);

    return [value.name.trim()];
  });
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

  const genreNames = metadata === null ? [] : uniqueNames(metadata.genres);

  const seriesNames =
    metadata === null
      ? []
      : uniqueNames([...metadata.collections, ...metadata.franchises]);

  const timeToBeat = metadata?.timeToBeat ?? null;

  const timeEstimates =
    timeToBeat === null
      ? []
      : [
          ...createTimeEstimate("Rushed", timeToBeat.hastilySeconds),
          ...createTimeEstimate("Main", timeToBeat.normallySeconds),
          ...createTimeEstimate("Completionist", timeToBeat.completelySeconds),
        ];

  const hasClassification = genreNames.length > 0 || seriesNames.length > 0;

  const hasQuickFacts = hasClassification || timeEstimates.length > 0;

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

              {hasQuickFacts ? (
                <div className="game-details__quick-facts">
                  {hasClassification ? (
                    <div className="game-details__quick-fact-group">
                      <span className="game-details__quick-fact-label">
                        Classification
                      </span>

                      <dl className="game-details__classification">
                        {genreNames.length === 0 ? null : (
                          <div>
                            <dt>Genres</dt>
                            <dd>{genreNames.join(", ")}</dd>
                          </div>
                        )}

                        {seriesNames.length === 0 ? null : (
                          <div>
                            <dt>Series</dt>
                            <dd>{seriesNames.join(", ")}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ) : null}

                  {timeEstimates.length === 0 ? null : (
                    <div className="game-details__quick-fact-group">
                      <span className="game-details__quick-fact-label">
                        Time to beat
                      </span>

                      <div className="game-details__time-estimates">
                        {timeEstimates.map((estimate) => (
                          <span key={estimate.label}>
                            <strong>{estimate.value}</strong>
                            <small>{estimate.label}</small>
                          </span>
                        ))}
                      </div>

                      {timeToBeat !== null && timeToBeat.submissionCount > 0 ? (
                        <p className="game-details__source-note">
                          Based on {timeToBeat.submissionCount.toLocaleString()}{" "}
                          IGDB submissions.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {metadata?.storyline === null ||
      metadata?.storyline === undefined ? null : (
        <details className="game-details__disclosure">
          <summary>
            <span>
              <strong>Storyline</strong>
              <small>May contain spoilers</small>
            </span>
          </summary>

          <div className="game-details__disclosure-body">
            <p className="game-details__long-copy">{metadata.storyline}</p>
          </div>
        </details>
      )}

      {screenshots.length === 0 ? null : (
        <details className="game-details__disclosure">
          <summary>
            <span>
              <strong>Screenshots</strong>
              <small>
                {screenshots.length} locally cached{" "}
                {screenshots.length === 1 ? "image" : "images"}
              </small>
            </span>
          </summary>

          <div className="game-details__disclosure-body">
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
          </div>
        </details>
      )}
    </>
  );
}
