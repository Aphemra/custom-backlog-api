import { TrophyGradeIcon } from "../../../components/ui/icons";
import { Tooltip } from "../../../components/ui/Tooltip";
import type {
  TrophyHistoryPlatformStatistic,
  TrophyHistoryStatistics,
  TrophyHistoryTypeStatistic,
} from "../../../domain/history";

const numberFormatter = new Intl.NumberFormat();

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

function trophyTypeLabel(statistic: TrophyHistoryTypeStatistic): string {
  return (
    statistic.trophyType.charAt(0).toLocaleUpperCase("en-US") +
    statistic.trophyType.slice(1)
  );
}

function segmentedColumns(
  statistics: ReadonlyArray<{
    readonly trophyCount: number;
  }>,
): string {
  return statistics
    .map((statistic) => `${Math.max(1, statistic.trophyCount)}fr`)
    .join(" ");
}

function TrophyGradeSegments({
  statistics,
}: {
  readonly statistics: readonly TrophyHistoryTypeStatistic[];
}) {
  const activeStatistics = statistics.filter(
    (statistic) => statistic.trophyCount > 0,
  );

  const totalTrophies = activeStatistics.reduce(
    (total, statistic) => total + statistic.trophyCount,
    0,
  );

  const totalPoints = activeStatistics.reduce(
    (total, statistic) => total + statistic.points,
    0,
  );

  return (
    <section className="history-segment-section">
      <div className="history-segment-section__heading">
        <h4>By trophy grade</h4>

        <span>
          {numberFormatter.format(totalTrophies)} trophies ·{" "}
          {numberFormatter.format(totalPoints)} points
        </span>
      </div>

      <div
        className="history-segmented-bar"
        style={{
          gridTemplateColumns: segmentedColumns(activeStatistics),
        }}
        role="group"
        aria-label="Trophy history divided by trophy grade"
      >
        {activeStatistics.map((statistic, index) => {
          const label = trophyTypeLabel(statistic);
          const alignment =
            index === 0
              ? "start"
              : index === activeStatistics.length - 1
                ? "end"
                : "center";

          return (
            <Tooltip
              key={statistic.trophyType}
              content={
                <span className="history-segment-tooltip">
                  <strong>{label}</strong>

                  <span>
                    {numberFormatter.format(statistic.trophyCount)} trophies
                  </span>

                  <span>{numberFormatter.format(statistic.points)} points</span>
                </span>
              }
              placement="top"
              alignment={alignment}
            >
              <span
                className={`history-segmented-bar__segment history-segmented-bar__segment--${statistic.trophyType}`}
                role="img"
                tabIndex={0}
                aria-label={`${label}: ${numberFormatter.format(
                  statistic.trophyCount,
                )} trophies worth ${numberFormatter.format(
                  statistic.points,
                )} points`}
              />
            </Tooltip>
          );
        })}
      </div>

      <div className="history-segment-legend">
        {activeStatistics.map((statistic) => (
          <div key={statistic.trophyType}>
            <TrophyGradeIcon grade={statistic.trophyType} />

            <span>{trophyTypeLabel(statistic)}</span>

            <strong>{numberFormatter.format(statistic.trophyCount)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformSegments({
  statistics,
}: {
  readonly statistics: readonly TrophyHistoryPlatformStatistic[];
}) {
  const activeStatistics = statistics.filter(
    (statistic) => statistic.trophyCount > 0,
  );

  const totalTrophies = activeStatistics.reduce(
    (total, statistic) => total + statistic.trophyCount,
    0,
  );

  const totalPoints = activeStatistics.reduce(
    (total, statistic) => total + statistic.points,
    0,
  );

  return (
    <section className="history-segment-section">
      <div className="history-segment-section__heading">
        <h4>By platform</h4>

        <span>
          {numberFormatter.format(totalTrophies)} trophies ·{" "}
          {numberFormatter.format(totalPoints)} points
        </span>
      </div>

      <div
        className="history-segmented-bar"
        style={{
          gridTemplateColumns: segmentedColumns(activeStatistics),
        }}
        role="group"
        aria-label="Trophy history divided by PlayStation platform"
      >
        {activeStatistics.map((statistic, index) => {
          const alignment =
            index === 0
              ? "start"
              : index === activeStatistics.length - 1
                ? "end"
                : "center";

          return (
            <Tooltip
              key={statistic.platform}
              content={
                <span className="history-segment-tooltip">
                  <strong>{statistic.platform}</strong>

                  <span>
                    {numberFormatter.format(statistic.trophyCount)} trophies
                  </span>

                  <span>{numberFormatter.format(statistic.points)} points</span>
                </span>
              }
              placement="top"
              alignment={alignment}
            >
              <span
                className={`history-segmented-bar__segment history-segmented-bar__segment--${statistic.platform.toLowerCase()}`}
                role="img"
                tabIndex={0}
                aria-label={`${statistic.platform}: ${numberFormatter.format(
                  statistic.trophyCount,
                )} trophies worth ${numberFormatter.format(
                  statistic.points,
                )} points`}
              />
            </Tooltip>
          );
        })}
      </div>

      <div className="history-segment-legend">
        {activeStatistics.map((statistic) => (
          <div key={statistic.platform}>
            <span
              className={`history-segment-legend__platform history-segment-legend__platform--${statistic.platform.toLowerCase()}`}
              aria-hidden="true"
            />

            <span>{statistic.platform}</span>

            <strong>{numberFormatter.format(statistic.trophyCount)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HistoryStatistics({
  statistics,
}: {
  readonly statistics: TrophyHistoryStatistics;
}) {
  const totalTrophies = statistics.byTrophyType.reduce(
    (total, statistic) => total + statistic.trophyCount,
    0,
  );

  const maximumMonthlyTrophies = Math.max(
    1,
    ...statistics.monthlyActivity.map((month) => month.trophyCount),
  );

  const busiestMonth =
    statistics.monthlyActivity.length === 0
      ? null
      : statistics.monthlyActivity.reduce((busiest, month) =>
          month.trophyCount > busiest.trophyCount ? month : busiest,
        );

  return (
    <section className="history-statistics">
      <div className="history-section-heading">
        <div>
          <p className="eyebrow">Aggregate history</p>
          <h3>Trophy activity</h3>
        </div>

        <div className="history-statistics__scope">
          <span>
            {numberFormatter.format(statistics.gamesRepresented)} games
          </span>

          <span>
            {numberFormatter.format(statistics.activeMonths)} active months
          </span>
        </div>
      </div>

      <div className="history-statistics__segments">
        <TrophyGradeSegments statistics={statistics.byTrophyType} />

        <PlatformSegments statistics={statistics.byPlatform} />
      </div>

      <article className="history-monthly-chart">
        <div className="history-monthly-chart__heading">
          <div>
            <h4>Monthly activity</h4>
            <span>Timestamped trophies earned per month</span>
          </div>

          {busiestMonth === null ? null : (
            <div>
              <span>Busiest month</span>

              <strong>
                {formatMonth(busiestMonth.month)} ·{" "}
                {numberFormatter.format(busiestMonth.trophyCount)}
              </strong>
            </div>
          )}
        </div>

        {statistics.monthlyActivity.length === 0 ? (
          <div className="history-monthly-chart__empty">
            No timestamped trophy activity is available yet.
          </div>
        ) : (
          <>
            <div
              className="history-monthly-chart__bars"
              style={{
                gridTemplateColumns: `repeat(${statistics.monthlyActivity.length}, minmax(2px, 1fr))`,
              }}
              role="img"
              aria-label="Monthly earned trophy activity"
            >
              {statistics.monthlyActivity.map((month, index) => {
                const barHeight = Math.max(
                  2,
                  (month.trophyCount / maximumMonthlyTrophies) * 100,
                );

                const tooltipAlignment =
                  index === 0
                    ? "start"
                    : index === statistics.monthlyActivity.length - 1
                      ? "end"
                      : "center";

                return (
                  <Tooltip
                    key={month.month}
                    content={
                      <span className="history-monthly-tooltip">
                        <strong>{formatMonth(month.month)}</strong>

                        <span>
                          {numberFormatter.format(month.trophyCount)}{" "}
                          {month.trophyCount === 1 ? "trophy" : "trophies"}
                        </span>

                        <span>
                          {numberFormatter.format(month.points)} points
                        </span>
                      </span>
                    }
                    placement="inside-top"
                    alignment={tooltipAlignment}
                  >
                    <span
                      className="history-monthly-chart__bar"
                      style={{ height: `${barHeight}%` }}
                      role="img"
                      tabIndex={0}
                      aria-label={`${formatMonth(
                        month.month,
                      )}: ${numberFormatter.format(
                        month.trophyCount,
                      )} trophies, ${numberFormatter.format(
                        month.points,
                      )} points`}
                    />
                  </Tooltip>
                );
              })}
            </div>

            <div className="history-chart__range">
              <span>{formatMonth(statistics.monthlyActivity[0]!.month)}</span>

              <span>
                {numberFormatter.format(totalTrophies)} timestamped trophies
              </span>

              <span>
                {formatMonth(statistics.monthlyActivity.at(-1)!.month)}
              </span>
            </div>
          </>
        )}
      </article>
    </section>
  );
}
