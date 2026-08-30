import { useState } from "react";
import type { TrophyHistoryMilestone } from "../../../domain/history";

const chartWidth = 720;
const chartHeight = 190;
const horizontalPadding = 30;
const verticalPadding = 32;
const calloutWidth = 112;
const calloutHeight = 38;

type HistoryRangePreset =
  | "all"
  | "12_months"
  | "6_months"
  | "3_months"
  | "1_month"
  | "custom";

const historyRangeOptions: ReadonlyArray<{
  readonly id: HistoryRangePreset;
  readonly label: string;
  readonly months: number | null;
}> = [
  {
    id: "all",
    label: "All",
    months: null,
  },
  {
    id: "12_months",
    label: "1 year",
    months: 12,
  },
  {
    id: "6_months",
    label: "6 months",
    months: 6,
  },
  {
    id: "3_months",
    label: "3 months",
    months: 3,
  },
  {
    id: "1_month",
    label: "1 month",
    months: 1,
  },
  {
    id: "custom",
    label: "Custom",
    months: null,
  },
];

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
});

const exactDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
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

function formatExactDate(value: string): string {
  return exactDateFormatter.format(new Date(value));
}

function dateInputValue(value: string): string {
  return value.slice(0, 10);
}

function subtractMonths(timestamp: number, months: number): number {
  const date = new Date(timestamp);

  date.setUTCMonth(date.getUTCMonth() - months);

  return date.getTime();
}

function customDateStart(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function customDateEnd(value: string): number {
  return Date.parse(`${value}T23:59:59.999Z`);
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

  const firstMilestone = levelMilestones[0] ?? null;
  const latestMilestone = levelMilestones.at(-1) ?? null;

  const [rangePreset, setRangePreset] = useState<HistoryRangePreset>("all");
  const [customFrom, setCustomFrom] = useState(
    firstMilestone === null ? "" : dateInputValue(firstMilestone.achievedAt),
  );
  const [customTo, setCustomTo] = useState(
    latestMilestone === null ? "" : dateInputValue(latestMilestone.achievedAt),
  );
  const [hoveredMilestoneId, setHoveredMilestoneId] = useState<string | null>(
    null,
  );

  if (firstMilestone === null || latestMilestone === null) {
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

  const firstAvailableTimestamp = Date.parse(firstMilestone.achievedAt);
  const latestAvailableTimestamp = Date.parse(latestMilestone.achievedAt);

  const selectedRangeOption = historyRangeOptions.find(
    (option) => option.id === rangePreset,
  )!;

  const customRangeInvalid =
    rangePreset === "custom" &&
    (customFrom === "" ||
      customTo === "" ||
      customDateStart(customFrom) > customDateEnd(customTo));

  let rangeStart = firstAvailableTimestamp;
  let rangeEnd = latestAvailableTimestamp;

  if (
    rangePreset !== "all" &&
    rangePreset !== "custom" &&
    selectedRangeOption.months !== null
  ) {
    rangeStart = subtractMonths(
      latestAvailableTimestamp,
      selectedRangeOption.months,
    );
  }

  if (rangePreset === "custom" && !customRangeInvalid) {
    rangeStart = customDateStart(customFrom);
    rangeEnd = customDateEnd(customTo);
  }

  const visibleMilestones = customRangeInvalid
    ? []
    : levelMilestones.filter((milestone) => {
        const achievedAt = Date.parse(milestone.achievedAt);

        return achievedAt >= rangeStart && achievedAt <= rangeEnd;
      });

  const visibleFirstMilestone = visibleMilestones[0] ?? null;
  const visibleLatestMilestone = visibleMilestones.at(-1) ?? null;

  const firstVisibleTimestamp =
    visibleFirstMilestone === null
      ? rangeStart
      : Date.parse(visibleFirstMilestone.achievedAt);

  const lastVisibleTimestamp =
    visibleLatestMilestone === null
      ? rangeEnd
      : Date.parse(visibleLatestMilestone.achievedAt);

  const timestampRange = lastVisibleTimestamp - firstVisibleTimestamp;

  const visibleLevels = visibleMilestones.map((milestone) => milestone.value);

  const lowestVisibleLevel =
    visibleLevels.length === 0 ? 0 : Math.min(...visibleLevels);
  const highestVisibleLevel =
    visibleLevels.length === 0 ? 10 : Math.max(...visibleLevels);

  const minimumLevel = Math.max(0, lowestVisibleLevel - 10);
  const maximumLevel = Math.max(minimumLevel + 10, highestVisibleLevel + 4);
  const levelRange = maximumLevel - minimumLevel;

  const drawableWidth = chartWidth - horizontalPadding * 2;
  const drawableHeight = chartHeight - verticalPadding * 2;

  const points: readonly ChartPoint[] = visibleMilestones.map((milestone) => ({
    milestone,
    x:
      timestampRange <= 0
        ? chartWidth / 2
        : horizontalPadding +
          ((Date.parse(milestone.achievedAt) - firstVisibleTimestamp) /
            timestampRange) *
            drawableWidth,
    y:
      verticalPadding +
      (1 - (milestone.value - minimumLevel) / levelRange) * drawableHeight,
  }));

  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");

  const hoveredPoint =
    points.find((point) => point.milestone.id === hoveredMilestoneId) ?? null;

  const calloutX =
    hoveredPoint === null
      ? 0
      : Math.min(
          chartWidth - horizontalPadding - calloutWidth,
          Math.max(horizontalPadding, hoveredPoint.x - calloutWidth / 2),
        );

  function selectRange(nextRange: HistoryRangePreset): void {
    setRangePreset(nextRange);
    setHoveredMilestoneId(null);
  }

  return (
    <section className="history-chart">
      <div className="history-section-heading">
        <div>
          <p className="eyebrow">Calculated progression</p>
          <h3>Trophy Level history</h3>
        </div>

        <div className="history-chart__latest">
          <span>Latest visible milestone</span>

          <strong>
            {visibleLatestMilestone === null
              ? "None"
              : `Level ${visibleLatestMilestone.value}`}
          </strong>
        </div>
      </div>

      <div className="history-chart__range-toolbar">
        <div
          className="history-chart__range-controls"
          aria-label="Trophy Level history range"
        >
          {historyRangeOptions.map((option) => (
            <button
              key={option.id}
              className={`history-chart__range-button${
                rangePreset === option.id
                  ? " history-chart__range-button--active"
                  : ""
              }`}
              type="button"
              aria-pressed={rangePreset === option.id}
              onClick={() => selectRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {rangePreset === "custom" ? (
          <div className="history-chart__custom-range">
            <label className="field">
              <span>From</span>

              <input
                type="date"
                value={customFrom}
                min={dateInputValue(firstMilestone.achievedAt)}
                max={dateInputValue(latestMilestone.achievedAt)}
                onChange={(event) => {
                  setCustomFrom(event.target.value);
                  setHoveredMilestoneId(null);
                }}
              />
            </label>

            <span
              className="history-chart__custom-separator"
              aria-hidden="true"
            >
              to
            </span>

            <label className="field">
              <span>To</span>

              <input
                type="date"
                value={customTo}
                min={dateInputValue(firstMilestone.achievedAt)}
                max={dateInputValue(latestMilestone.achievedAt)}
                onChange={(event) => {
                  setCustomTo(event.target.value);
                  setHoveredMilestoneId(null);
                }}
              />
            </label>

            {customRangeInvalid ? (
              <p role="alert">
                The From date must not be later than the To date.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {visibleMilestones.length === 0 ? (
        <div className="history-chart__no-results">
          <strong>No Trophy Level milestones in this range.</strong>

          <span>
            Choose a wider range to see more of your calculated progression.
          </span>
        </div>
      ) : (
        <>
          <div
            className="history-chart__canvas"
            onMouseLeave={() => setHoveredMilestoneId(null)}
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`Trophy Level progression from ${formatExactDate(
                visibleFirstMilestone!.achievedAt,
              )} through ${formatExactDate(
                visibleLatestMilestone!.achievedAt,
              )}`}
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

              {hoveredPoint === null ? null : (
                <g
                  className="history-chart__hover-indicator"
                  aria-hidden="true"
                >
                  <line
                    className="history-chart__hover-line"
                    x1={hoveredPoint.x}
                    x2={hoveredPoint.x}
                    y1={calloutHeight + 7}
                    y2={hoveredPoint.y}
                  />

                  <rect
                    className="history-chart__hover-box"
                    x={calloutX}
                    y="3"
                    width={calloutWidth}
                    height={calloutHeight}
                    rx="3"
                  />

                  <text
                    className="history-chart__hover-text"
                    x={calloutX + calloutWidth / 2}
                    y="17"
                    textAnchor="middle"
                  >
                    Level {hoveredPoint.milestone.value}
                  </text>

                  <text
                    className="history-chart__hover-date"
                    x={calloutX + calloutWidth / 2}
                    y="31"
                    textAnchor="middle"
                  >
                    {formatDate(hoveredPoint.milestone.achievedAt)}
                  </text>
                </g>
              )}

              {points.map((point) => {
                const selected = point.milestone.id === hoveredMilestoneId;

                return (
                  <g key={point.milestone.id}>
                    <circle
                      className={`history-chart__point${
                        selected ? " history-chart__point--selected" : ""
                      }`}
                      cx={point.x}
                      cy={point.y}
                      r={selected ? "5" : "4"}
                    />

                    <circle
                      className="history-chart__point-target"
                      cx={point.x}
                      cy={point.y}
                      r="11"
                      tabIndex={0}
                      role="img"
                      aria-label={`Level ${
                        point.milestone.value
                      } reached ${formatExactDate(point.milestone.achievedAt)}`}
                      onMouseEnter={() =>
                        setHoveredMilestoneId(point.milestone.id)
                      }
                      onFocus={() => setHoveredMilestoneId(point.milestone.id)}
                      onBlur={() => setHoveredMilestoneId(null)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="history-chart__range">
            <time dateTime={visibleFirstMilestone!.achievedAt}>
              {formatDate(visibleFirstMilestone!.achievedAt)}
            </time>

            <span>
              {visibleMilestones.length} calculated level{" "}
              {visibleMilestones.length === 1 ? "milestone" : "milestones"}
            </span>

            <time dateTime={visibleLatestMilestone!.achievedAt}>
              {formatDate(visibleLatestMilestone!.achievedAt)}
            </time>
          </div>
        </>
      )}
    </section>
  );
}
