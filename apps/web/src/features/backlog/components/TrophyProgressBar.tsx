import type { TrophyProgress } from "../../../domain/trophy";
import { formatCompletionPercent, getSafeCompletionPercent } from "../services/formatTrophyProgress";

interface TrophyProgressBarProps {
  trophyProgress: TrophyProgress;
}

export function TrophyProgressBar({ trophyProgress }: TrophyProgressBarProps) {
  const safeCompletionPercent = getSafeCompletionPercent(trophyProgress);

  return (
    <div className="trophy-progress" aria-label={`Trophy completion: ${formatCompletionPercent(trophyProgress)}`}>
      <div className="trophy-progress__track">
        <div className="trophy-progress__fill" style={{ width: `${safeCompletionPercent}%` }} />
      </div>

      <span className="trophy-progress__label">{formatCompletionPercent(trophyProgress)}</span>
    </div>
  );
}
