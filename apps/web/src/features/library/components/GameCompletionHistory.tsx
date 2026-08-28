import type {
  LibraryTrophySummary,
  LibraryTrophyCounts,
} from "../../../domain/libraryGame";
import type { LibraryGameTrophySnapshot } from "../../../domain/libraryGameDetails";

interface GameCompletionHistoryProps {
  readonly summary: LibraryTrophySummary | null;
  readonly history: readonly LibraryGameTrophySnapshot[];
}

function totalTrophies(counts: LibraryTrophyCounts): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);

  if (totalMinutes < 1) {
    return `${totalSeconds} ${totalSeconds === 1 ? "second" : "seconds"}`;
  }

  if (totalHours < 1) {
    return `${totalMinutes} ${
      totalMinutes === 1 ? "minute" : "minutes"
    }, ${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  }

  if (totalDays < 1) {
    return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}, ${
      minutes
    } ${minutes === 1 ? "minute" : "minutes"}`;
  }

  if (totalDays < 31) {
    return `${totalDays} ${totalDays === 1 ? "day" : "days"}, ${hours} ${
      hours === 1 ? "hour" : "hours"
    }`;
  }

  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  }

  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }

  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  }

  return parts.join(", ");
}

function unavailableMessage(
  reason:
    | "not_earned"
    | "not_applicable"
    | "missing_timestamps"
    | "first_trophy_timestamp_missing"
    | null,
): string | null {
  switch (reason) {
    case "not_earned":
      return "Not earned yet.";

    case "not_applicable":
      return "This trophy list does not include this milestone.";

    case "missing_timestamps":
      return "One or more earned trophies have no timestamp.";

    case "first_trophy_timestamp_missing":
      return "The first earned trophy does not have a timestamp.";

    case null:
      return null;
  }
}

function Milestone({
  title,
  earnedAt,
  elapsedMilliseconds,
  unavailableReason,
  durationPrefix,
}: {
  readonly title: string;
  readonly earnedAt: string | null;
  readonly elapsedMilliseconds: number | null;
  readonly unavailableReason:
    | "not_earned"
    | "not_applicable"
    | "missing_timestamps"
    | "first_trophy_timestamp_missing"
    | null;
  readonly durationPrefix?: string;
}) {
  return (
    <article className="game-milestone">
      <h4>{title}</h4>

      {earnedAt === null ? (
        <p>{unavailableMessage(unavailableReason)}</p>
      ) : (
        <>
          <time dateTime={earnedAt}>{formatDate(earnedAt)}</time>

          {elapsedMilliseconds === null ? null : (
            <strong>
              {durationPrefix ?? "Completed in"}{" "}
              {formatElapsed(elapsedMilliseconds)}
            </strong>
          )}
        </>
      )}
    </article>
  );
}

function meaningfulHistory(
  history: readonly LibraryGameTrophySnapshot[],
): readonly LibraryGameTrophySnapshot[] {
  return history.filter((snapshot, index) => {
    const previous = history[index - 1];

    if (previous === undefined) {
      return true;
    }

    return (
      snapshot.progressPercent !== previous.progressPercent ||
      totalTrophies(snapshot.earnedTrophies) !==
        totalTrophies(previous.earnedTrophies) ||
      totalTrophies(snapshot.totalTrophies) !==
        totalTrophies(previous.totalTrophies) ||
      snapshot.platinumEarned !== previous.platinumEarned ||
      snapshot.is100Percent !== previous.is100Percent
    );
  });
}

export function GameCompletionHistory({
  summary,
  history,
}: GameCompletionHistoryProps) {
  if (summary === null && history.length === 0) {
    return null;
  }

  const significantSnapshots = meaningfulHistory(history).toReversed();

  return (
    <section className="game-details__section">
      <div className="game-details__section-heading">
        <div>
          <p className="eyebrow">Trophy timeline</p>
          <h3>Completion milestones</h3>
        </div>
      </div>

      {summary?.timing === null || summary === null ? (
        <p className="game-details__empty-copy">
          Detailed milestone timing is not available for this trophy list.
        </p>
      ) : (
        <div className="game-milestones">
          <Milestone
            title="First trophy"
            earnedAt={summary.timing.firstTrophy.earnedAt}
            elapsedMilliseconds={null}
            unavailableReason={summary.timing.firstTrophy.unavailableReason}
          />

          {summary.hasPlatinum ? (
            <Milestone
              title="Platinum"
              earnedAt={summary.timing.platinum.earnedAt}
              elapsedMilliseconds={
                summary.timing.platinum.elapsedSinceFirstTrophyMilliseconds
              }
              unavailableReason={summary.timing.platinum.unavailableReason}
              durationPrefix="Platinum in"
            />
          ) : null}

          <Milestone
            title="100%"
            earnedAt={summary.timing.completion.earnedAt}
            elapsedMilliseconds={
              summary.timing.completion.elapsedSinceFirstTrophyMilliseconds
            }
            unavailableReason={summary.timing.completion.unavailableReason}
          />
        </div>
      )}

      {significantSnapshots.length === 0 ? null : (
        <details className="game-progress-history">
          <summary>
            <span>Progress history</span>
            <strong>{significantSnapshots.length}</strong>
          </summary>

          <ol>
            {significantSnapshots.map((snapshot) => (
              <li key={snapshot.capturedAt}>
                <time dateTime={snapshot.capturedAt}>
                  {formatDate(snapshot.capturedAt)}
                </time>

                <div>
                  <strong>{snapshot.progressPercent}%</strong>

                  <span>
                    {totalTrophies(snapshot.earnedTrophies)} /{" "}
                    {totalTrophies(snapshot.totalTrophies)} trophies
                  </span>
                </div>

                <div className="game-progress-history__badges">
                  {snapshot.platinumEarned ? <span>Platinum</span> : null}

                  {snapshot.is100Percent ? <span>100%</span> : null}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
