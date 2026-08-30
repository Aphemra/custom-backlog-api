import { useMemo, useState } from "react";
import { TrophyGradeIcon, TrophyIcon } from "../../../components/ui/icons";
import type {
  TrophyHistoryMilestone,
  TrophyHistoryMilestoneKind,
  TrophyHistorySortDirection,
} from "../../../domain/history";

type MilestoneFilter = "all" | TrophyHistoryMilestoneKind;

const milestoneFilters: readonly {
  readonly id: MilestoneFilter;
  readonly label: string;
}[] = [
  {
    id: "all",
    label: "All milestones",
  },
  {
    id: "trophy_total",
    label: "Trophy totals",
  },
  {
    id: "platinum_total",
    label: "Platinum totals",
  },
  {
    id: "trophy_level",
    label: "Trophy Levels",
  },
];

const numberFormatter = new Intl.NumberFormat();

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function milestoneTitle(milestone: TrophyHistoryMilestone): string {
  if (milestone.kind === "platinum_total") {
    return `${numberFormatter.format(milestone.value)} platinum trophies`;
  }

  if (milestone.kind === "trophy_level") {
    return `Trophy Level ${numberFormatter.format(milestone.value)}`;
  }

  return `${numberFormatter.format(milestone.value)} total trophies`;
}

function milestoneKindLabel(milestone: TrophyHistoryMilestone): string {
  if (milestone.kind === "platinum_total") {
    return "Platinum milestone";
  }

  if (milestone.kind === "trophy_level") {
    return "Level milestone";
  }

  return "Trophy milestone";
}

export function TrophyMilestones({
  milestones,
}: {
  readonly milestones: readonly TrophyHistoryMilestone[];
}) {
  const [filter, setFilter] = useState<MilestoneFilter>("all");
  const [direction, setDirection] =
    useState<TrophyHistorySortDirection>("desc");

  const filteredMilestones = useMemo(() => {
    const matching =
      filter === "all"
        ? milestones
        : milestones.filter((milestone) => milestone.kind === filter);

    return matching.toSorted((left, right) => {
      const comparison =
        Date.parse(left.achievedAt) - Date.parse(right.achievedAt);

      return direction === "asc" ? comparison : -comparison;
    });
  }, [direction, filter, milestones]);

  return (
    <div className="history-milestones">
      <div className="history-milestone-controls">
        <div className="alert-filter-list" aria-label="Milestone types">
          {milestoneFilters.map((option) => (
            <button
              key={option.id}
              className={`alert-filter${
                filter === option.id ? " alert-filter--active" : ""
              }`}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          className="button button--quiet history-direction-button"
          type="button"
          onClick={() =>
            setDirection((currentDirection) =>
              currentDirection === "desc" ? "asc" : "desc",
            )
          }
        >
          {direction === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      <div className="history-result-summary">
        <span>
          {numberFormatter.format(filteredMilestones.length)}{" "}
          {filteredMilestones.length === 1 ? "milestone" : "milestones"}
        </span>
      </div>

      {filteredMilestones.length === 0 ? (
        <div className="empty-state">
          <h3>No milestones match this filter.</h3>

          <p>
            Milestones are calculated entirely from timestamped earned trophies.
          </p>
        </div>
      ) : (
        <div className="history-milestone-list">
          {filteredMilestones.map((milestone) => (
            <article
              className={`history-milestone history-milestone--${milestone.kind}`}
              key={milestone.id}
            >
              <div className="history-milestone__icon">
                {milestone.kind === "platinum_total" ? (
                  <TrophyGradeIcon grade="platinum" />
                ) : (
                  <TrophyIcon />
                )}
              </div>

              <div className="history-milestone__identity">
                <span>{milestoneKindLabel(milestone)}</span>

                <strong>{milestoneTitle(milestone)}</strong>

                <p>
                  {milestone.triggeringTrophyName ??
                    `Trophy #${milestone.triggeringTrophyId}`}{" "}
                  · {milestone.triggeringGameTitle}
                </p>
              </div>

              <div className="history-milestone__totals">
                <span>
                  {numberFormatter.format(milestone.cumulativeTrophyCount)}{" "}
                  trophies
                </span>

                <span>
                  {numberFormatter.format(milestone.cumulativePoints)} points
                </span>
              </div>

              <div className="history-milestone__date">
                <time dateTime={milestone.achievedAt}>
                  {dateFormatter.format(new Date(milestone.achievedAt))}
                </time>

                <span>
                  Level {numberFormatter.format(milestone.calculatedLevel)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
