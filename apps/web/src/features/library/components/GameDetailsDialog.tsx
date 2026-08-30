import { useEffect, useState } from "react";
import { useToast } from "../../../components/toast/useToast";
import { Dialog } from "../../../components/ui/Dialog";
import { IconButton } from "../../../components/ui/IconButton";
import { SyncIcon, TrophyGradeIcon } from "../../../components/ui/icons";
import {
  playStatusLabels,
  type LibraryGameListItem,
  type LibraryTrophyCounts,
} from "../../../domain/libraryGame";
import type { LibraryGameDetails } from "../../../domain/libraryGameDetails";
import { ApiError } from "../../../services/api/apiClient";
import { igdbApi } from "../../../services/api/igdbApi";
import { libraryApi } from "../../../services/api/libraryApi";
import { GameCompletionHistory } from "./GameCompletionHistory";
import { GameDetailsResources } from "./GameDetailsResources";
import { GameTrophyList } from "./GameTrophyList";
import { IgdbMetadataOverview } from "./IgdbMetadataOverview";

interface GameDetailsDialogProps {
  readonly game: LibraryGameListItem | null;
  readonly onClose: () => void;
  readonly onRefreshed: () => Promise<void>;
}

interface OpenGameDetailsDialogProps {
  readonly game: LibraryGameListItem;
  readonly onClose: () => void;
  readonly onRefreshed: () => Promise<void>;
}

type LoadState = "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while loading this game.";
}

function totalTrophies(counts: LibraryTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function formatTrophyGradeProgress(
  earned: number,
  attainable: number,
  total: number,
): string {
  if (attainable === total) {
    return `${earned} / ${total}`;
  }

  return `${earned} / ${attainable} (${total})`;
}

function TrophyOverview({ details }: { readonly details: LibraryGameDetails }) {
  const summary = details.game.trophySummary;

  if (summary === null) {
    return (
      <div className="game-details__trophy-overview">
        <div className="game-details__section-heading">
          <div>
            <p className="eyebrow">PlayStation trophies</p>
            <h3>Trophy progress</h3>
          </div>
        </div>

        <p className="game-details__empty-copy">
          No locally synchronized trophy data is connected to this game.
        </p>
      </div>
    );
  }

  const earnedCount = totalTrophies(summary.earnedTrophies);
  const totalCount = totalTrophies(summary.totalTrophies);
  const attainableCount = totalTrophies(
    summary.availability.attainableTrophies,
  );
  const unobtainableCount = totalTrophies(
    summary.availability.unobtainableTrophies,
  );
  const hasUnobtainableTrophies = unobtainableCount > 0;

  const displayedProgressPercent = hasUnobtainableTrophies
    ? summary.availability.attainableProgressPercent
    : summary.progressPercent;

  const earnedProgressSharePercent = hasUnobtainableTrophies
    ? summary.availability.earnedProgressSharePercent
    : summary.progressPercent;

  const unobtainableProgressSharePercent = hasUnobtainableTrophies
    ? summary.availability.unobtainableProgressSharePercent
    : 0;

  const attainablePointsRemaining = Math.max(
    0,
    summary.availability.attainablePoints - summary.points.earned,
  );

  return (
    <div className="game-details__trophy-overview">
      <div className="game-details__section-heading">
        <div>
          <p className="eyebrow">PlayStation trophies</p>

          <div className="game-details__trophy-title-line">
            <h3>Trophy progress</h3>

            {hasUnobtainableTrophies ? (
              <span className="game-details__availability-summary">
                {unobtainableCount.toLocaleString()} unobtainable {"("}
                {summary.availability.unobtainablePoints.toLocaleString()}{" "}
                points{")"}
              </span>
            ) : null}
          </div>
        </div>

        <strong className="game-details__progress-value">
          {displayedProgressPercent}%
        </strong>
      </div>

      <div className="game-details__trophy-layout">
        <div className="game-details__trophy-progress">
          <div
            className={`game-details__progress-track${
              hasUnobtainableTrophies
                ? " game-details__progress-track--unobtainable"
                : ""
            }`}
            role="progressbar"
            aria-label={
              hasUnobtainableTrophies
                ? "Attainable trophy completion"
                : "Trophy completion"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayedProgressPercent}
          >
            <span
              className="game-details__progress-earned"
              style={{ width: `${earnedProgressSharePercent}%` }}
            />

            {hasUnobtainableTrophies ? (
              <span
                className="game-details__progress-unobtainable"
                style={{ width: `${unobtainableProgressSharePercent}%` }}
              />
            ) : null}
          </div>
        </div>

        <div
          className="game-details__trophy-counts"
          aria-label="Trophy counts by type"
        >
          <span className="game-details__trophy-count game-details__trophy-count--bronze">
            <TrophyGradeIcon grade="bronze" />

            <strong>
              {formatTrophyGradeProgress(
                summary.earnedTrophies.bronze,
                summary.availability.attainableTrophies.bronze,
                summary.totalTrophies.bronze,
              )}
            </strong>
          </span>

          <span className="game-details__trophy-count game-details__trophy-count--silver">
            <TrophyGradeIcon grade="silver" />

            <strong>
              {formatTrophyGradeProgress(
                summary.earnedTrophies.silver,
                summary.availability.attainableTrophies.silver,
                summary.totalTrophies.silver,
              )}
            </strong>
          </span>

          <span className="game-details__trophy-count game-details__trophy-count--gold">
            <TrophyGradeIcon grade="gold" />

            <strong>
              {formatTrophyGradeProgress(
                summary.earnedTrophies.gold,
                summary.availability.attainableTrophies.gold,
                summary.totalTrophies.gold,
              )}
            </strong>
          </span>

          {summary.totalTrophies.platinum > 0 ? (
            <span className="game-details__trophy-count game-details__trophy-count--platinum">
              <TrophyGradeIcon grade="platinum" />

              <strong>
                {formatTrophyGradeProgress(
                  summary.earnedTrophies.platinum,
                  summary.availability.attainableTrophies.platinum,
                  summary.totalTrophies.platinum,
                )}
              </strong>
            </span>
          ) : null}
        </div>
      </div>

      <div className="game-details__trophy-summary">
        <div>
          <strong>
            {earnedCount} / {attainableCount}
            {hasUnobtainableTrophies ? ` (${totalCount})` : ""}
          </strong>
          <span>Trophies</span>
        </div>

        <div>
          <strong>
            {summary.points.earned.toLocaleString()} /{" "}
            {summary.availability.attainablePoints.toLocaleString()}
            {hasUnobtainableTrophies
              ? ` (${summary.points.total.toLocaleString()})`
              : ""}
          </strong>
          <span>Trophy points</span>
        </div>

        <div>
          <strong>
            {(hasUnobtainableTrophies
              ? attainablePointsRemaining
              : summary.points.remaining
            ).toLocaleString()}
          </strong>
          <span>
            {hasUnobtainableTrophies
              ? "Attainable points remaining"
              : "Points remaining"}
          </span>
        </div>
      </div>

      {summary.is100Percent ? (
        <p className="game-details__completion-note">
          100% completion achieved
        </p>
      ) : null}

      {!summary.is100Percent && summary.availability.isMaxAttainable ? (
        <p className="game-details__completion-note">
          Maximum attainable completion achieved
          {summary.platinumEarned ? " with Platinum earned" : ""}
        </p>
      ) : null}

      {summary.platinumEarned &&
      !summary.is100Percent &&
      !summary.availability.isMaxAttainable ? (
        <p className="game-details__completion-note">
          Platinum earned but not 100%
        </p>
      ) : null}
    </div>
  );
}

function GameDetailsContent({
  details,
  sourceGame,
}: {
  readonly details: LibraryGameDetails;
  readonly sourceGame: LibraryGameListItem;
}) {
  const fallbackCover =
    details.game.artwork === null
      ? null
      : {
          imageId: details.game.artwork.imageId,
          url: details.game.artwork.url,
        };

  return (
    <div className="game-details">
      <IgdbMetadataOverview
        title={details.game.title}
        metadata={details.igdb}
        fallbackCover={fallbackCover}
        showTitle={false}
        actions={
          <GameDetailsResources
            gameTitle={sourceGame.title}
            resources={sourceGame.resources}
            igdbUrl={details.igdb?.igdbUrl ?? null}
          />
        }
        badges={
          <>
            <span className="platform-badge">{details.game.platform}</span>

            <span
              className={`status-label status-label--${details.game.playStatus}`}
            >
              {playStatusLabels[details.game.playStatus]}
            </span>

            {details.game.isUnobtainable ? (
              <span className="status-label status-label--unobtainable">
                Unobtainable
              </span>
            ) : null}
          </>
        }
      />

      <section className="game-details__section game-details__trophy-workspace">
        <TrophyOverview details={details} />

        <GameCompletionHistory
          summary={details.game.trophySummary}
          history={details.trophyHistory}
        />

        <GameTrophyList
          gameId={details.game.id}
          hasPlayStationLink={details.playStation !== null}
        />
      </section>
    </div>
  );
}

function OpenGameDetailsDialog({
  game,
  onClose,
  onRefreshed,
}: OpenGameDetailsDialogProps) {
  const { showToast } = useToast();

  const [details, setDetails] = useState<LibraryGameDetails | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [refreshingMetadata, setRefreshingMetadata] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void libraryApi
      .getDetails(game.id, controller.signal)
      .then((loadedDetails) => {
        setDetails(loadedDetails);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => controller.abort();
  }, [game.id]);

  async function handleRefreshMetadata(): Promise<void> {
    setRefreshingMetadata(true);

    try {
      await igdbApi.refreshExistingGame(game.id);

      const refreshedDetails = await libraryApi.getDetails(game.id);

      setDetails(refreshedDetails);

      await onRefreshed();

      showToast({
        tone: "success",
        message: `${game.title}'s IGDB metadata was refreshed.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setRefreshingMetadata(false);
    }
  }

  return (
    <Dialog
      open
      title={game.title}
      description="Game metadata, trophy progress, cached media, and resources."
      headerActions={
        details?.igdb === null || details?.igdb === undefined ? undefined : (
          <IconButton
            className={`dialog__metadata-sync${
              refreshingMetadata ? " dialog__metadata-sync--active" : ""
            }`}
            label={
              refreshingMetadata
                ? "Resyncing IGDB metadata"
                : "Resync IGDB metadata"
            }
            tooltip={
              refreshingMetadata
                ? "Refreshing metadata and cached artwork from IGDB."
                : "Refresh metadata and cached artwork from IGDB."
            }
            icon={<SyncIcon />}
            disabled={refreshingMetadata}
            aria-busy={refreshingMetadata}
            tooltipPlacement="bottom"
            tooltipAlignment="end"
            onClick={() => void handleRefreshMetadata()}
          />
        )
      }
      size="large"
      onClose={onClose}
    >
      {loadState === "loading" ? (
        <div className="game-details__loading" role="status">
          Loading game details…
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loadState === "ready" && details !== null ? (
        <GameDetailsContent details={details} sourceGame={game} />
      ) : null}
    </Dialog>
  );
}

export function GameDetailsDialog({
  game,
  onClose,
  onRefreshed,
}: GameDetailsDialogProps) {
  if (game === null) {
    return null;
  }

  return (
    <OpenGameDetailsDialog
      key={game.id}
      game={game}
      onClose={onClose}
      onRefreshed={onRefreshed}
    />
  );
}
