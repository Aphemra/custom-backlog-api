import type { TrophyHistoryMilestone } from "../../../domain/history";

const chartWidth = 720;
const chartHeight = 190;
const horizontalPadding = 30;
const verticalPadding = 22;

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

interface ChartPoint {
  readonly milestone: TrophyHistoryMilestone;
  readonly x: number;
  readonly y: number;
}

function formatDate(value: string): string {
  return shortDateFormatter.format(new Date(value));
}

export function HistoryProgressionChart({
  milestones,
}: {
  readonly milestones: readonly TrophyHistoryMilestone[];
}) {
  const levelMilestones = milestones
    .filter((milestone) => milestone.kind === "trophy_level")
    .toSorted(
      (left, right) =>
        Date.parse(left.achievedAt) - Date.parse(right.achievedAt),
    );

  if (levelMilestones.length === 0) {
    return (
      <section className="history-chart history-chart--empty">
        <div className="history-section-heading">
          <div>
            <p className="eyebrow">Calculated progression</p>
            <h3>Trophy Level history</h3>
          </div>
        </div>

        <p>
          Trophy Level milestones will appear after enough timestamped trophies
          are locally cached.
        </p>
      </section>
    );
  }

  const firstTimestamp = Date.parse(levelMilestones[0]!.achievedAt);
  const lastTimestamp = Date.parse(levelMilestones.at(-1)!.achievedAt);
  const timestampRange = Math.max(1, lastTimestamp - firstTimestamp);
  const maximumLevel = Math.max(
    10,
    ...levelMilestones.map((milestone) => milestone.value),
  );

  const drawableWidth = chartWidth - horizontalPadding * 2;
  const drawableHeight = chartHeight - verticalPadding * 2;

  const points: readonly ChartPoint[] = levelMilestones.map((milestone) => ({
    milestone,
    x:
      horizontalPadding +
      ((Date.parse(milestone.achievedAt) - firstTimestamp) / timestampRange) *
        drawableWidth,
    y: verticalPadding + (1 - milestone.value / maximumLevel) * drawableHeight,
  }));

  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");

  const latestMilestone = levelMilestones.at(-1)!;

  return (
    <section className="history-chart">
      <div className="history-section-heading">
        <div>
          <p className="eyebrow">Calculated progression</p>
          <h3>Trophy Level history</h3>
        </div>

        <div className="history-chart__latest">
          <span>Latest milestone</span>
          <strong>Level {latestMilestone.value}</strong>
        </div>
      </div>

      <div className="history-chart__canvas">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`Trophy Level progression from ${formatDate(
            levelMilestones[0]!.achievedAt,
          )} through ${formatDate(latestMilestone.achievedAt)}`}
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

          <polyline className="history-chart__line" points={pointString} />

          {points.map((point) => (
            <circle
              key={point.milestone.id}
              className="history-chart__point"
              cx={point.x}
              cy={point.y}
              r="4"
            />
          ))}
        </svg>
      </div>

      <div className="history-chart__range">
        <time dateTime={levelMilestones[0]!.achievedAt}>
          {formatDate(levelMilestones[0]!.achievedAt)}
        </time>

        <span>
          {levelMilestones.length} calculated level{" "}
          {levelMilestones.length === 1 ? "milestone" : "milestones"}
        </span>

        <time dateTime={latestMilestone.achievedAt}>
          {formatDate(latestMilestone.achievedAt)}
        </time>
      </div>
    </section>
  );
}
