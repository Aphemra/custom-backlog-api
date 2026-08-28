import { TrophyGradeIcon } from "../ui/icons";
import { useProfileProgression } from "./useProfileProgression";

const numberFormatter = new Intl.NumberFormat();

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function ProfileTrophySummary() {
  const { progression, loadState } = useProfileProgression();

  if (loadState === "loading") {
    return (
      <section
        className="profile-summary profile-summary--placeholder"
        aria-label="PlayStation trophy profile"
        aria-busy="true"
      >
        Loading trophy profile…
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section
        className="profile-summary profile-summary--placeholder"
        aria-label="PlayStation trophy profile"
      >
        Trophy profile unavailable
      </section>
    );
  }

  if (progression === null) {
    return (
      <section
        className="profile-summary profile-summary--placeholder"
        aria-label="PlayStation trophy profile"
      >
        Sync PSN to display profile totals
      </section>
    );
  }

  const level = progression.server.level;
  const levelProgress = progression.server.progressPercent;
  const maximumLevelReached = level >= 999;

  return (
    <section
      className="profile-summary"
      aria-label="PlayStation trophy profile"
    >
      <div className="profile-summary__level">
        <span>Level</span>
        <strong>{level}</strong>
      </div>

      <div className="profile-summary__main">
        <div className="profile-summary__trophies" aria-label="Trophy totals">
          <span className="profile-trophy profile-trophy--platinum">
            <TrophyGradeIcon grade="platinum" />
            <strong>{formatNumber(progression.earnedTrophies.platinum)}</strong>
          </span>

          <span className="profile-trophy profile-trophy--gold">
            <TrophyGradeIcon grade="gold" />
            <strong>{formatNumber(progression.earnedTrophies.gold)}</strong>
          </span>

          <span className="profile-trophy profile-trophy--silver">
            <TrophyGradeIcon grade="silver" />
            <strong>{formatNumber(progression.earnedTrophies.silver)}</strong>
          </span>

          <span className="profile-trophy profile-trophy--bronze">
            <TrophyGradeIcon grade="bronze" />
            <strong>{formatNumber(progression.earnedTrophies.bronze)}</strong>
          </span>
        </div>

        <div className="profile-summary__progress">
          <div className="profile-summary__progress-label">
            <span>
              {maximumLevelReached
                ? "Maximum trophy level"
                : `${levelProgress}% to level ${level + 1}`}
            </span>

            <span>
              {maximumLevelReached
                ? `${formatNumber(progression.points.total)} total points`
                : `${formatNumber(
                    progression.points.toNextLevel,
                  )} points remaining`}
            </span>
          </div>

          <div
            className="profile-summary__progress-track"
            role="progressbar"
            aria-label={
              maximumLevelReached
                ? "Maximum trophy level reached"
                : `Progress from trophy level ${level} to ${level + 1}`
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={maximumLevelReached ? 100 : levelProgress}
          >
            <span
              style={{
                width: `${maximumLevelReached ? 100 : levelProgress}%`,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
