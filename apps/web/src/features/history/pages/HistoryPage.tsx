import { useEffect, useState } from "react";
import { BacklogActivity } from "../components/BacklogActivity";
import { HistoryProgressionChart } from "../components/HistoryProgressionChart";
import { HistoryStatistics } from "../components/HistoryStatistics";
import { TrophyHistoryLog } from "../components/TrophyHistoryLog";
import { TrophyMilestones } from "../components/TrophyMilestones";
import { TrophyGradeIcon } from "../../../components/ui/icons";
import type {
  TrophyHistoryCoverage,
  TrophyHistoryMilestone,
  TrophyHistoryOverview,
  TrophyHistoryStatistics,
} from "../../../domain/history";
import { ApiError } from "../../../services/api/apiClient";
import { historyApi } from "../../../services/api/historyApi";

type LoadState = "loading" | "ready" | "error";

const historyViews = [
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "trophies",
    label: "Trophy Log",
  },
  {
    id: "milestones",
    label: "Milestones",
  },
  {
    id: "backlog",
    label: "Backlog Activity",
  },
] as const;

type HistoryView = (typeof historyViews)[number]["id"];

const numberFormatter = new Intl.NumberFormat();

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(value: string | null): string {
  return value === null ? "Unavailable" : dateFormatter.format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while loading trophy history.";
}

function countTrophies(counts: {
  readonly bronze: number;
  readonly silver: number;
  readonly gold: number;
  readonly platinum: number;
}): number {
  return counts.bronze + counts.silver + counts.gold + counts.platinum;
}

function milestoneLabel(milestone: TrophyHistoryMilestone): string {
  if (milestone.kind === "platinum_total") {
    return `${numberFormatter.format(milestone.value)} platinum trophies`;
  }

  if (milestone.kind === "trophy_level") {
    return `Trophy Level ${numberFormatter.format(milestone.value)}`;
  }

  return `${numberFormatter.format(milestone.value)} total trophies`;
}

function coverageDescription(coverage: TrophyHistoryCoverage): string {
  if (coverage.isComplete === true) {
    return "Every locally cached earned trophy is represented in this timeline.";
  }

  if (coverage.isComplete === null) {
    return "Run Sync Trophies to compare the local timeline with your current PlayStation totals.";
  }

  const missingTimestamps = countTrophies(
    coverage.missingEarnedTrophyTimestamps,
  );

  if (missingTimestamps > 0) {
    return (
      `${numberFormatter.format(missingTimestamps)} earned ` +
      `${missingTimestamps === 1 ? "trophy has" : "trophies have"} no ` +
      "earned timestamp and cannot be placed in the timeline."
    );
  }

  return "The locally cached trophy timeline does not yet match the latest PlayStation profile totals.";
}

function OverviewPanel({
  overview,
  milestones,
  statistics,
}: {
  readonly overview: TrophyHistoryOverview;
  readonly milestones: readonly TrophyHistoryMilestone[];
  readonly statistics: TrophyHistoryStatistics;
}) {
  const latestTrophy = overview.latestEarnedTrophy;
  const latestMilestone = overview.latestMilestone;

  return (
    <div className="history-overview">
      <div className="history-summary-grid">
        <div>
          <span>Earned trophies</span>
          <strong>
            {numberFormatter.format(overview.summary.earnedTrophyCount)}
          </strong>
        </div>

        <div>
          <span>Platinum trophies</span>
          <strong className="history-summary-grid__platinum">
            {numberFormatter.format(overview.summary.earnedTrophies.platinum)}
          </strong>
        </div>

        <div>
          <span>Trophy points</span>
          <strong>
            {numberFormatter.format(overview.summary.totalPoints)}
          </strong>
        </div>

        <div>
          <span>Calculated level</span>
          <strong>
            {numberFormatter.format(overview.summary.calculatedLevel)}
          </strong>
        </div>
      </div>

      <div
        className={`history-coverage history-coverage--${
          overview.coverage.isComplete === true
            ? "complete"
            : overview.coverage.isComplete === false
              ? "incomplete"
              : "unknown"
        }`}
      >
        <strong>
          {overview.coverage.isComplete === true
            ? "Timeline complete"
            : overview.coverage.isComplete === false
              ? "Timeline incomplete"
              : "Coverage not yet verified"}
        </strong>

        <span>{coverageDescription(overview.coverage)}</span>
      </div>

      <HistoryProgressionChart milestones={milestones} />

      <HistoryStatistics statistics={statistics} />

      <div className="history-overview__recent">
        <article className="history-recent-card">
          <p className="history-recent-card__label">Latest trophy</p>

          {latestTrophy === null ? (
            <p className="history-recent-card__empty">
              No timestamped trophies are locally cached yet.
            </p>
          ) : (
            <>
              <div className="history-recent-card__title">
                <TrophyGradeIcon grade={latestTrophy.trophyType} />

                <strong>
                  {latestTrophy.trophyName ??
                    `Hidden trophy #${latestTrophy.trophyId}`}
                </strong>
              </div>

              <span>{latestTrophy.gameTitle}</span>

              <time dateTime={latestTrophy.earnedAt}>
                {formatDate(latestTrophy.earnedAt)}
              </time>
            </>
          )}
        </article>

        <article className="history-recent-card">
          <p className="history-recent-card__label">Latest milestone</p>

          {latestMilestone === null ? (
            <p className="history-recent-card__empty">
              No calculated milestones are available yet.
            </p>
          ) : (
            <>
              <strong>{milestoneLabel(latestMilestone)}</strong>

              <span>
                Triggered by{" "}
                {latestMilestone.triggeringTrophyName ??
                  latestMilestone.triggeringGameTitle}
              </span>

              <time dateTime={latestMilestone.achievedAt}>
                {formatDate(latestMilestone.achievedAt)}
              </time>
            </>
          )}
        </article>
      </div>

      <div className="history-range">
        <span>
          <strong>First recorded trophy</strong>
          {formatDate(overview.summary.oldestEarnedAt)}
        </span>

        <span>
          <strong>Most recent trophy</strong>
          {formatDate(overview.summary.newestEarnedAt)}
        </span>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const [activeView, setActiveView] = useState<HistoryView>("overview");
  const [overview, setOverview] = useState<TrophyHistoryOverview | null>(null);
  const [milestones, setMilestones] = useState<
    readonly TrophyHistoryMilestone[]
  >([]);
  const [statistics, setStatistics] = useState<TrophyHistoryStatistics | null>(
    null,
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    void Promise.all([
      historyApi.getOverview(abortController.signal),
      historyApi.listMilestones(
        {
          direction: "asc",
        },
        abortController.signal,
      ),
      historyApi.getStatistics(abortController.signal),
    ])
      .then(([loadedOverview, loadedMilestones, loadedStatistics]) => {
        if (!abortController.signal.aborted) {
          setOverview(loadedOverview);
          setMilestones(loadedMilestones.milestones);
          setStatistics(loadedStatistics);
          setErrorMessage(null);
          setLoadState("ready");
        }
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      });

    return () => abortController.abort();
  }, []);

  return (
    <section
      className="library-page history-page"
      aria-labelledby="history-title"
    >
      <div className="library-heading">
        <div>
          <p className="eyebrow">PlayStation record</p>

          <h2 id="history-title">History</h2>

          <p className="library-heading__description">
            Review trophy progression and the separate history of changes made
            to this local backlog.
          </p>
        </div>
      </div>

      <div className="history-tabs" role="tablist" aria-label="History views">
        {historyViews.map((view) => {
          const active = activeView === view.id;

          return (
            <button
              key={view.id}
              id={`history-tab-${view.id}`}
              className={`history-tab${active ? " history-tab--active" : ""}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`history-panel-${view.id}`}
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      <div
        id={`history-panel-${activeView}`}
        className="history-panel"
        role="tabpanel"
        aria-labelledby={`history-tab-${activeView}`}
      >
        {activeView === "overview" && loadState === "loading" ? (
          <div className="empty-state" role="status">
            <h3>Building trophy history…</h3>

            <p>
              Calculating progression from locally cached earned-trophy dates.
            </p>
          </div>
        ) : null}

        {activeView === "overview" && loadState === "error" ? (
          <div className="empty-state">
            <h3>History could not be loaded.</h3>

            <p>{errorMessage}</p>
          </div>
        ) : null}

        {activeView === "overview" &&
        loadState === "ready" &&
        overview !== null &&
        statistics !== null ? (
          <OverviewPanel
            overview={overview}
            milestones={milestones}
            statistics={statistics}
          />
        ) : null}

        {activeView === "trophies" ? <TrophyHistoryLog /> : null}

        {activeView === "milestones" ? (
          <TrophyMilestones milestones={milestones} />
        ) : null}

        {activeView === "backlog" ? <BacklogActivity /> : null}
      </div>
    </section>
  );
}
