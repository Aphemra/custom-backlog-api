import { useEffect, useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import {
  playStatusLabels,
  type LibraryGameListItem,
  type LibraryTrophyCounts,
} from "../../../domain/libraryGame";
import type { LibraryGameDetails } from "../../../domain/libraryGameDetails";
import { ApiError } from "../../../services/api/apiClient";
import { libraryApi } from "../../../services/api/libraryApi";
import { GameCompletionHistory } from "./GameCompletionHistory";
import { GameDetailsResources } from "./GameDetailsResources";
import { GameTrophyList } from "./GameTrophyList";
import { IgdbMetadataOverview } from "./IgdbMetadataOverview";

interface GameDetailsDialogProps {
  readonly game: LibraryGameListItem | null;
  readonly onClose: () => void;
}

interface OpenGameDetailsDialogProps {
  readonly game: LibraryGameListItem;
  readonly onClose: () => void;
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
          Bronze {summary.earnedTrophies.bronze} /{" "}
          {summary.totalTrophies.bronze}
        </span>

        <span className="game-details__trophy-count game-details__trophy-count--silver">
          Silver {summary.earnedTrophies.silver} /{" "}
          {summary.totalTrophies.silver}
        </span>

        <span className="game-details__trophy-count game-details__trophy-count--gold">
          Gold {summary.earnedTrophies.gold} / {summary.totalTrophies.gold}
        </span>

        {summary.totalTrophies.platinum > 0 ? (
          <span className="game-details__trophy-count game-details__trophy-count--platinum">
            Platinum {summary.earnedTrophies.platinum} /{" "}
            {summary.totalTrophies.platinum}
          </span>
        ) : null}
      </div>

      {summary.platinumEarned && !summary.is100Percent ? (
        <p className="game-details__completion-note">
          Platinum earned · Not 100%
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

function OpenGameDetailsDialog({ game, onClose }: OpenGameDetailsDialogProps) {
  const [details, setDetails] = useState<LibraryGameDetails | null>(null);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        <GameDetailsContent details={details} sourceGame={game} />
      ) : null}
    </Dialog>
  );
}

export function GameDetailsDialog({ game, onClose }: GameDetailsDialogProps) {
  if (game === null) {
    return null;
  }

  return <OpenGameDetailsDialog key={game.id} game={game} onClose={onClose} />;
}
