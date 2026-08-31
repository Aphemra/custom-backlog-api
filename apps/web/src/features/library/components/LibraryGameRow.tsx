import {
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { IconButton } from "../../../components/ui/IconButton";
import {
  DeleteIcon,
  EditIcon,
  HideIcon,
  MoveToBottomIcon,
  MoveToTopIcon,
  ShowIcon,
  TrophyGradeIcon,
} from "../../../components/ui/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import {
  playStatusLabels,
  type LibraryGameListItem,
  type LibraryTrophySummary,
} from "../../../domain/libraryGame";
import {
  formatCompactElapsed,
  formatElapsed,
} from "../libraryTrophyFormatting";
import { GameResourceLinks } from "./GameResourceLinks";

interface LibraryGameRowProps {
  readonly game: LibraryGameListItem;
  readonly position: number | null;
  readonly positionCount: number | null;
  readonly dragHandle: ReactNode | null;
  readonly busy: boolean;
  readonly onMoveToPosition: ((position: number) => void) | null;
  readonly onMoveToTop: (() => void) | null;
  readonly onMoveToBottom: (() => void) | null;
  readonly onOpenDetails: () => void;
  readonly onEdit: () => void;
  readonly onHide: () => void;
  readonly onUnhide: () => void;
  readonly onDelete: () => void;
}

function totalTrophies(counts: {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function playStatusClassName(
  playStatus: LibraryGameListItem["playStatus"],
): string {
  return `game-row--status-${playStatus.replaceAll("_", "-")}`;
}

function trophyStateClassName(summary: LibraryTrophySummary | null): string {
  if (summary === null) {
    return "game-row--trophies-untracked";
  }

  if (summary.is100Percent) {
    return "game-row--trophies-complete";
  }

  if (summary.platinumEarned) {
    return "game-row--trophies-platinum";
  }

  if (totalTrophies(summary.earnedTrophies) > 0) {
    return "game-row--trophies-progress";
  }

  return "game-row--trophies-none";
}

function completionStateLabel(
  summary: LibraryTrophySummary | null,
): string | null {
  if (summary === null) {
    return null;
  }

  if (summary.is100Percent && summary.platinumEarned) {
    return "Platinum earned\n100% complete";
  }

  if (summary.is100Percent) {
    return "100% complete";
  }

  if (summary.availability.isMaxAttainable) {
    return summary.platinumEarned
      ? "Platinum earned\nMaximum attainable completion reached"
      : "Maximum attainable completion reached";
  }

  if (summary.platinumEarned) {
    return "Platinum earned\nNot 100% complete";
  }

  return null;
}

function completionDisplayLabel(
  summary: LibraryTrophySummary | null,
): string | null {
  if (summary === null) {
    return null;
  }

  if (summary.is100Percent) {
    return "100%";
  }

  if (summary.availability.isMaxAttainable) {
    return "Max attainable";
  }

  if (summary.platinumEarned) {
    return "Platinum";
  }

  return null;
}

function completionTimingLabel(
  summary: LibraryTrophySummary | null,
): string | null {
  if (summary?.timing === null || summary === null) {
    return null;
  }

  if (
    summary.is100Percent &&
    summary.timing.completion.elapsedSinceFirstTrophyMilliseconds !== null
  ) {
    return `Completed in ${formatElapsed(
      summary.timing.completion.elapsedSinceFirstTrophyMilliseconds,
    )}`;
  }

  if (
    summary.platinumEarned &&
    summary.timing.platinum.elapsedSinceFirstTrophyMilliseconds !== null
  ) {
    return `Platinum in ${formatElapsed(
      summary.timing.platinum.elapsedSinceFirstTrophyMilliseconds,
    )}`;
  }

  return null;
}

function compactCompletionTimingLabel(
  summary: LibraryTrophySummary | null,
): string | null {
  if (summary?.timing === null || summary === null) {
    return null;
  }

  if (
    summary.is100Percent &&
    summary.timing.completion.elapsedSinceFirstTrophyMilliseconds !== null
  ) {
    return formatCompactElapsed(
      summary.timing.completion.elapsedSinceFirstTrophyMilliseconds,
    );
  }

  if (
    summary.platinumEarned &&
    summary.timing.platinum.elapsedSinceFirstTrophyMilliseconds !== null
  ) {
    return formatCompactElapsed(
      summary.timing.platinum.elapsedSinceFirstTrophyMilliseconds,
    );
  }

  return null;
}

interface GamePositionEditorProps {
  readonly position: number;
  readonly positionCount: number;
  readonly busy: boolean;
  readonly onMoveToPosition: (position: number) => void;
  readonly onMoveToTop: () => void;
  readonly onMoveToBottom: () => void;
}

function GamePositionEditor({
  position,
  positionCount,
  busy,
  onMoveToPosition,
  onMoveToTop,
  onMoveToBottom,
}: GamePositionEditorProps) {
  const [draftPosition, setDraftPosition] = useState(String(position));

  function commitPosition(): void {
    const normalizedPosition = draftPosition.trim();

    if (!/^\d+$/.test(normalizedPosition)) {
      setDraftPosition(String(position));

      return;
    }

    const nextPosition = Number(normalizedPosition);

    if (
      !Number.isSafeInteger(nextPosition) ||
      nextPosition < 1 ||
      nextPosition > positionCount
    ) {
      setDraftPosition(String(position));

      return;
    }

    setDraftPosition(String(nextPosition));

    if (nextPosition !== position) {
      onMoveToPosition(nextPosition);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    commitPosition();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraftPosition(String(position));
      event.currentTarget.select();
    }
  }

  return (
    <form
      className="game-row__position-form"
      aria-label={`Change position ${position} of ${positionCount}`}
      onSubmit={handleSubmit}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        className="game-row__position-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={`Position from 1 through ${positionCount}`}
        value={draftPosition}
        disabled={busy}
        onChange={(event) => setDraftPosition(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commitPosition}
        onKeyDown={handleKeyDown}
      />

      <div className="game-row__position-shortcuts">
        <IconButton
          className="game-row__position-shortcut"
          label="Move to top"
          tooltip="Move to top"
          tooltipPlacement="top"
          tooltipAlignment="start"
          icon={<MoveToTopIcon />}
          disabled={busy || position === 1}
          onClick={() => {
            setDraftPosition("1");
            onMoveToTop();
          }}
        />

        <IconButton
          className="game-row__position-shortcut"
          label="Move to bottom of active backlog"
          tooltip="Move to bottom"
          tooltipPlacement="top"
          tooltipAlignment="start"
          icon={<MoveToBottomIcon />}
          disabled={busy || position === positionCount}
          onClick={() => {
            setDraftPosition(String(positionCount));
            onMoveToBottom();
          }}
        />
      </div>
    </form>
  );
}

export function LibraryGameRow({
  game,
  position,
  positionCount,
  dragHandle,
  busy,
  onMoveToPosition,
  onMoveToTop,
  onMoveToBottom,
  onOpenDetails,
  onEdit,
  onHide,
  onUnhide,
  onDelete,
}: LibraryGameRowProps) {
  const isHidden = game.hiddenAt !== null;

  const [failedImageId, setFailedImageId] = useState<string | null>(null);

  const trophySummary = game.trophySummary;

  const showArtwork =
    game.artwork !== null && failedImageId !== game.artwork.imageId;

  const earnedTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.earnedTrophies);

  const totalTrophyCount =
    trophySummary === null ? 0 : totalTrophies(trophySummary.totalTrophies);

  const attainableTrophyCount =
    trophySummary === null
      ? 0
      : totalTrophies(trophySummary.availability.attainableTrophies);

  const unobtainableTrophyCount =
    trophySummary === null
      ? 0
      : totalTrophies(trophySummary.availability.unobtainableTrophies);

  const hasUnobtainableTrophies = unobtainableTrophyCount > 0;

  const displayedProgressPercent =
    trophySummary === null
      ? 0
      : hasUnobtainableTrophies
        ? trophySummary.availability.attainableProgressPercent
        : trophySummary.progressPercent;

  const earnedProgressSharePercent =
    trophySummary === null
      ? 0
      : hasUnobtainableTrophies
        ? trophySummary.availability.earnedProgressSharePercent
        : trophySummary.progressPercent;

  const unobtainableProgressSharePercent =
    trophySummary?.availability.unobtainableProgressSharePercent ?? 0;

  const completionState = completionStateLabel(trophySummary);
  const completionDisplay = completionDisplayLabel(trophySummary);
  const completionTiming = completionTimingLabel(trophySummary);
  const compactCompletionTiming = compactCompletionTimingLabel(trophySummary);

  const completionTooltip = [completionState, completionTiming]
    .filter((value): value is string => value !== null)
    .join("\n");

  return (
    <article
      className={`game-row ${playStatusClassName(
        game.playStatus,
      )} ${trophyStateClassName(trophySummary)}${
        isHidden ? " game-row--hidden" : ""
      }${game.isUnobtainable ? " game-row--unobtainable" : ""}`}
    >
      <button
        className="game-row__details-surface"
        type="button"
        aria-label={`Open details for ${game.title}`}
        onClick={onOpenDetails}
      />

      <div
        className="game-row__order"
        aria-label={position === null ? "Hidden" : `Position ${position}`}
      >
        {isHidden || dragHandle === null ? (
          <span className="order-number">
            {position === null ? "—" : position}
          </span>
        ) : (
          <>
            {dragHandle}

            {position !== null &&
            positionCount !== null &&
            onMoveToPosition !== null &&
            onMoveToTop !== null &&
            onMoveToBottom !== null ? (
              <GamePositionEditor
                key={position}
                position={position}
                positionCount={positionCount}
                busy={busy}
                onMoveToPosition={onMoveToPosition}
                onMoveToTop={onMoveToTop}
                onMoveToBottom={onMoveToBottom}
              />
            ) : (
              <span className="order-number">{position}</span>
            )}
          </>
        )}
      </div>

      <div
        className={`game-row__artwork${
          game.artwork?.role === "icon" ? " game-row__artwork--icon" : ""
        }`}
      >
        {showArtwork && game.artwork !== null ? (
          <img
            src={game.artwork.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailedImageId(game.artwork?.imageId ?? null)}
          />
        ) : (
          <span aria-hidden="true">
            {game.title.trim().charAt(0).toLocaleUpperCase("en-US")}
          </span>
        )}
      </div>

      <div className="game-row__identity">
        <div className="game-row__title-line">
          <div className="game-row__title-viewport">
            <h3>{game.title}</h3>
          </div>

          <span className="platform-badge">{game.platform}</span>

          {isHidden ? <span className="hidden-badge">Hidden</span> : null}
        </div>

        <div className="game-row__status-line">
          <span className={`status-label status-label--${game.playStatus}`}>
            {playStatusLabels[game.playStatus]}
          </span>

          {game.isUnobtainable ? (
            <span className="status-label status-label--unobtainable">
              Unobtainable
            </span>
          ) : null}
        </div>

        <GameResourceLinks gameTitle={game.title} resources={game.resources} />
      </div>

      <div className="game-row__progress-panel">
        {trophySummary === null ? (
          <span className="trophy-placeholder">No trophy snapshot</span>
        ) : (
          <>
            <div className="game-row__progress-copy">
              <strong>{displayedProgressPercent}%</strong>

              <Tooltip
                content={
                  hasUnobtainableTrophies
                    ? `${earnedTrophyCount} earned, ${attainableTrophyCount} attainable, ${totalTrophyCount} total trophies`
                    : `${earnedTrophyCount} earned of ${totalTrophyCount} total trophies`
                }
                placement="top"
                alignment="end"
              >
                <span tabIndex={0}>
                  {earnedTrophyCount} /{" "}
                  {hasUnobtainableTrophies
                    ? attainableTrophyCount
                    : totalTrophyCount}
                  {hasUnobtainableTrophies ? ` (${totalTrophyCount})` : ""}{" "}
                  trophies
                </span>
              </Tooltip>
            </div>

            <div
              className="game-row__progress-track"
              role="progressbar"
              aria-label={
                hasUnobtainableTrophies
                  ? `${game.title} attainable trophy completion`
                  : `${game.title} trophy completion`
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayedProgressPercent}
            >
              <span
                className="game-row__progress-earned"
                style={{ width: `${earnedProgressSharePercent}%` }}
              />

              {hasUnobtainableTrophies ? (
                <span
                  className="game-row__progress-unobtainable"
                  style={{
                    width: `${unobtainableProgressSharePercent}%`,
                  }}
                />
              ) : null}
            </div>

            <div
              className="game-row__trophy-counts"
              aria-label="Earned and available trophies by grade"
            >
              <span
                className="game-row__trophy-count game-row__trophy-count--bronze"
                aria-label={`Bronze trophies: ${trophySummary.earnedTrophies.bronze} of ${trophySummary.totalTrophies.bronze}`}
              >
                <TrophyGradeIcon grade="bronze" />

                <strong>
                  {trophySummary.earnedTrophies.bronze}/
                  {trophySummary.totalTrophies.bronze}
                </strong>
              </span>

              <span
                className="game-row__trophy-count game-row__trophy-count--silver"
                aria-label={`Silver trophies: ${trophySummary.earnedTrophies.silver} of ${trophySummary.totalTrophies.silver}`}
              >
                <TrophyGradeIcon grade="silver" />

                <strong>
                  {trophySummary.earnedTrophies.silver}/
                  {trophySummary.totalTrophies.silver}
                </strong>
              </span>

              <span
                className="game-row__trophy-count game-row__trophy-count--gold"
                aria-label={`Gold trophies: ${trophySummary.earnedTrophies.gold} of ${trophySummary.totalTrophies.gold}`}
              >
                <TrophyGradeIcon grade="gold" />

                <strong>
                  {trophySummary.earnedTrophies.gold}/
                  {trophySummary.totalTrophies.gold}
                </strong>
              </span>

              <span
                className={`game-row__trophy-count game-row__trophy-count--platinum${
                  trophySummary.totalTrophies.platinum === 0
                    ? " game-row__trophy-count--unavailable"
                    : ""
                }`}
                aria-label={
                  trophySummary.totalTrophies.platinum === 0
                    ? "This game has no platinum trophy"
                    : `Platinum trophies: ${trophySummary.earnedTrophies.platinum} of ${trophySummary.totalTrophies.platinum}`
                }
              >
                <TrophyGradeIcon grade="platinum" />

                <strong>
                  {trophySummary.totalTrophies.platinum === 0
                    ? "—"
                    : `${trophySummary.earnedTrophies.platinum}/${trophySummary.totalTrophies.platinum}`}
                </strong>
              </span>
            </div>

            <div className="game-row__metadata-rail">
              <Tooltip
                content={
                  hasUnobtainableTrophies
                    ? `${trophySummary.points.earned.toLocaleString()} earned, ${trophySummary.availability.attainablePoints.toLocaleString()} attainable, ${trophySummary.points.total.toLocaleString()} total points`
                    : `${trophySummary.points.earned.toLocaleString()} earned of ${trophySummary.points.total.toLocaleString()} total points`
                }
                placement="top"
                alignment="end"
              >
                <div className="game-row__points" tabIndex={0}>
                  <strong>
                    {trophySummary.points.earned.toLocaleString()}
                  </strong>

                  <span>
                    {" "}
                    /{" "}
                    {hasUnobtainableTrophies
                      ? trophySummary.availability.attainablePoints.toLocaleString()
                      : trophySummary.points.total.toLocaleString()}
                    {hasUnobtainableTrophies
                      ? ` (${trophySummary.points.total.toLocaleString()})`
                      : ""}{" "}
                    points
                  </span>
                </div>
              </Tooltip>

              {completionState === null || completionDisplay === null ? null : (
                <Tooltip
                  content={completionTooltip}
                  placement="top"
                  alignment="end"
                >
                  <span
                    className="game-row__completion-text"
                    tabIndex={0}
                    aria-label={completionTooltip}
                  >
                    <span
                      className="game-row__completion-icon"
                      aria-hidden="true"
                    >
                      {trophySummary.is100Percent ||
                      trophySummary.availability.isMaxAttainable
                        ? "✓ "
                        : "◆ "}
                    </span>

                    <span>{completionDisplay}</span>

                    {compactCompletionTiming === null ? null : (
                      <span> in {compactCompletionTiming}</span>
                    )}
                  </span>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </div>

      <div
        className="game-row__actions"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <IconButton
          label={`Edit ${game.title}`}
          tooltip="Edit"
          tooltipPlacement="top"
          tooltipAlignment="center"
          icon={<EditIcon />}
          disabled={busy}
          onClick={onEdit}
        />

        {isHidden ? (
          <IconButton
            label={`Show ${game.title}`}
            tooltip="Show"
            tooltipPlacement="top"
            tooltipAlignment="center"
            icon={<ShowIcon />}
            disabled={busy}
            onClick={onUnhide}
          />
        ) : (
          <IconButton
            label={`Hide ${game.title}`}
            tooltip="Hide"
            tooltipPlacement="top"
            tooltipAlignment="center"
            icon={<HideIcon />}
            disabled={busy}
            onClick={onHide}
          />
        )}

        <IconButton
          label={`Delete ${game.title}`}
          tooltip="Delete"
          tooltipPlacement="top"
          tooltipAlignment="center"
          icon={<DeleteIcon />}
          tone="danger"
          disabled={busy}
          onClick={onDelete}
        />
      </div>
    </article>
  );
}
