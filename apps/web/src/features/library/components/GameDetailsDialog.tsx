import { useEffect, useState } from "react";
import { useToast } from "../../../components/toast/useToast";
import { Dialog } from "../../../components/ui/Dialog";
import { TrophyGradeIcon } from "../../../components/ui/icons";
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

function TrophyOverview({ details }: { readonly details: LibraryGameDetails }) {
  const summary = details.game.trophySummary;

  if (summary === null) {
    return (
      <section className="game-details__section">
        <div className="game-details__section-heading">
          <div>
            <p className="eyebrow">PlayStation trophies</p>
            <h3>Trophy progress</h3>
          </div>
        </div>

        <p className="game-details__empty-copy">
          No locally synchronized trophy data is connected to this game.
        </p>
      </section>
    );
  }

  const earnedCount = totalTrophies(summary.earnedTrophies);
  const availableCount = totalTrophies(summary.totalTrophies);

  return (
    <section className="game-details__section">
      <div className="game-details__section-heading">
        <div>
          <p className="eyebrow">PlayStation trophies</p>
          <h3>Trophy progress</h3>
        </div>

        <strong className="game-details__progress-value">
          {summary.progressPercent}%
        </strong>
      </div>

      <div
        className="game-details__progress-track"
        role="progressbar"
        aria-label="Trophy completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.progressPercent}
      >
        <span style={{ width: `${summary.progressPercent}%` }} />
      </div>

      <div className="game-details__trophy-summary">
        <div>
          <strong>
            {earnedCount} / {availableCount}
          </strong>
          <span>Trophies</span>
        </div>

        <div>
          <strong>
            {summary.points.earned.toLocaleString()} /{" "}
            {summary.points.total.toLocaleString()}
          </strong>
          <span>Trophy points</span>
        </div>

        <div>
          <strong>{summary.points.remaining.toLocaleString()}</strong>
          <span>Points remaining</span>
        </div>
      </div>

      <div
        className="game-details__trophy-counts"
        aria-label="Trophy counts by type"
      >
        <span className="game-details__trophy-count game-details__trophy-count--bronze">
          <TrophyGradeIcon grade="bronze" />

          <strong>
            {summary.earnedTrophies.bronze} / {summary.totalTrophies.bronze}
          </strong>
        </span>

        <span className="game-details__trophy-count game-details__trophy-count--silver">
          <TrophyGradeIcon grade="silver" />

          <strong>
            {summary.earnedTrophies.silver} / {summary.totalTrophies.silver}
          </strong>
        </span>

        <span className="game-details__trophy-count game-details__trophy-count--gold">
          <TrophyGradeIcon grade="gold" />

          <strong>
            {summary.earnedTrophies.gold} / {summary.totalTrophies.gold}
          </strong>
        </span>

        {summary.totalTrophies.platinum > 0 ? (
          <span className="game-details__trophy-count game-details__trophy-count--platinum">
            <TrophyGradeIcon grade="platinum" />

            <strong>
              {summary.earnedTrophies.platinum} /{" "}
              {summary.totalTrophies.platinum}
            </strong>
          </span>
        ) : null}
      </div>

      {summary.platinumEarned && !summary.is100Percent ? (
        <p className="game-details__completion-note">
          Platinum earned but not 100%
        </p>
      ) : null}

      {summary.is100Percent ? (
        <p className="game-details__completion-note">
          100% completion achieved
        </p>
      ) : null}
    </section>
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

      <TrophyOverview details={details} />

      <GameCompletionHistory
        summary={details.game.trophySummary}
        history={details.trophyHistory}
      />

      <GameDetailsResources
        gameTitle={sourceGame.title}
        resources={sourceGame.resources}
        igdbUrl={details.igdb?.igdbUrl ?? null}
      />

      <GameTrophyList
        gameId={details.game.id}
        hasPlayStationLink={details.playStation !== null}
      />
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
        <>
          {details.igdb === null ? null : (
            <div className="game-details__toolbar">
              <span>
                IGDB metadata stored{" "}
                {new Date(details.igdb.storedAt).toLocaleString()}
              </span>

              <button
                className="button button--quiet"
                type="button"
                disabled={refreshingMetadata}
                onClick={() => void handleRefreshMetadata()}
              >
                {refreshingMetadata
                  ? "Resyncing IGDB…"
                  : "Resync IGDB Metadata"}
              </button>
            </div>
          )}

          <GameDetailsContent details={details} sourceGame={game} />
        </>
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
