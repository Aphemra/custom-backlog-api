import { TrophyGradeIcon } from "../../../components/ui/icons";
import type { TrophyHistoryStatistics } from "../../../domain/history";

const chartWidth = 720;
const chartHeight = 180;
const horizontalPadding = 18;
const verticalPadding = 18;
const numberFormatter = new Intl.NumberFormat();

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

function percentage(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
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

  const drawableWidth = chartWidth - horizontalPadding * 2;
  const drawableHeight = chartHeight - verticalPadding * 2;
  const barSlotWidth =
    statistics.monthlyActivity.length === 0
      ? drawableWidth
      : drawableWidth / statistics.monthlyActivity.length;
  const barWidth = Math.max(2, barSlotWidth - 2);

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

      <div className="history-statistics__distributions">
        <article>
          <h4>By trophy grade</h4>

          <div className="history-distribution-list">
            {statistics.byTrophyType.map((statistic) => (
              <div
                className={`history-distribution history-distribution--${statistic.trophyType}`}
                key={statistic.trophyType}
              >
                <div className="history-distribution__identity">
                  <TrophyGradeIcon grade={statistic.trophyType} />

                  <span>{statistic.trophyType}</span>
                </div>

                <div className="history-distribution__track">
                  <span
                    style={{
                      width: `${percentage(
                        statistic.trophyCount,
                        totalTrophies,
                      )}%`,
                    }}
                  />
                </div>

                <strong>{numberFormatter.format(statistic.trophyCount)}</strong>

                <small>{numberFormatter.format(statistic.points)} points</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <h4>By platform</h4>

          <div className="history-distribution-list">
            {statistics.byPlatform.map((statistic) => (
              <div
                className={`history-distribution history-distribution--${statistic.platform.toLowerCase()}`}
                key={statistic.platform}
              >
                <div className="history-distribution__identity">
                  <span className="platform-badge">{statistic.platform}</span>
                </div>

                <div className="history-distribution__track">
                  <span
                    style={{
                      width: `${percentage(
                        statistic.trophyCount,
                        totalTrophies,
                      )}%`,
                    }}
                  />
                </div>

                <strong>{numberFormatter.format(statistic.trophyCount)}</strong>

                <small>{numberFormatter.format(statistic.points)} points</small>
              </div>
            ))}
          </div>
        </article>
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
            <div className="history-monthly-chart__canvas">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label="Monthly earned trophy activity"
              >
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = verticalPadding + (1 - ratio) * drawableHeight;

                  return (
                    <line
                      key={ratio}
                      className="history-chart__grid-line"
                      x1={horizontalPadding}
                      x2={chartWidth - horizontalPadding}
                      y1={y}
                      y2={y}
                    />
                  );
                })}

                {statistics.monthlyActivity.map((month, index) => {
                  const barHeight =
                    (month.trophyCount / maximumMonthlyTrophies) *
                    drawableHeight;
                  const x =
                    horizontalPadding +
                    index * barSlotWidth +
                    (barSlotWidth - barWidth) / 2;
                  const y = verticalPadding + drawableHeight - barHeight;

                  return (
                    <rect
                      key={month.month}
                      className="history-monthly-chart__bar"
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="1"
                    >
                      <title>
                        {formatMonth(month.month)}:{" "}
                        {numberFormatter.format(month.trophyCount)} trophies,{" "}
                        {numberFormatter.format(month.points)} points
                      </title>
                    </rect>
                  );
                })}
              </svg>
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
