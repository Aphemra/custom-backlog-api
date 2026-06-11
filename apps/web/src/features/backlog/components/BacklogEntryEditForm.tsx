import { useState } from "react";
import { playstationPlatforms } from "../../../data/mock/playstationPlatforms";
import type { GameEntryUpdate } from "../store/useBacklogStore";
import type { GameEntry, PlayStatus } from "../../../domain/backlog";
import type { PlatformId } from "../../../domain/platform";
import type { TrophyStatus } from "../../../domain/trophy";
import { formatPlayStatus, formatTrophyStatus } from "../../../domain/display";

const playStatusOptions: PlayStatus[] = ["backlog", "playing", "beaten", "completed", "shelved", "abandoned"];

const trophyStatusOptions: TrophyStatus[] = [
  "not_started",
  "started",
  "cleanup",
  "platinumed",
  "hundred_percent",
  "skipped",
  "unobtainable",
  "not_applicable",
];

interface BacklogEntryEditFormProps {
  game: GameEntry;
  onCancel: () => void;
  onSave: (updates: GameEntryUpdate) => void;
}

export function BacklogEntryEditForm({ game, onCancel, onSave }: BacklogEntryEditFormProps) {
  const [title, setTitle] = useState(game.title);
  const [platformIds, setPlatformIds] = useState<PlatformId[]>(game.platformIds);
  const [playStatus, setPlayStatus] = useState<PlayStatus>(game.playStatus);
  const [trophyStatus, setTrophyStatus] = useState<TrophyStatus>(game.trophyStatus);
  const [completionPercent, setCompletionPercent] = useState(game.trophyProgress.completionPercent?.toString() ?? "");
  const [earnedTrophies, setEarnedTrophies] = useState(game.trophyProgress.earnedTrophies?.toString() ?? "");
  const [totalTrophies, setTotalTrophies] = useState(game.trophyProgress.totalTrophies?.toString() ?? "");
  const [platinumEarned, setPlatinumEarned] = useState(game.trophyProgress.platinumEarned ?? false);
  const [psnProfilesUrl, setPsnProfilesUrl] = useState(game.trophyProgress.psnProfilesUrl ?? "");
  const [rating, setRating] = useState(game.rating?.toString() ?? "");
  const [notes, setNotes] = useState(game.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  function togglePlatform(platformId: PlatformId) {
    setPlatformIds((currentPlatformIds) =>
      currentPlatformIds.includes(platformId)
        ? currentPlatformIds.filter((currentId) => currentId !== platformId)
        : [...currentPlatformIds, platformId],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setFormError("Game title is required.");
      return;
    }

    if (platformIds.length === 0) {
      setFormError("At least one platform is required.");
      return;
    }

    const parsedCompletionPercent = parseOptionalNumber(completionPercent);
    const parsedEarnedTrophies = parseOptionalNumber(earnedTrophies);
    const parsedTotalTrophies = parseOptionalNumber(totalTrophies);
    const parsedRating = parseOptionalNumber(rating);

    if (parsedCompletionPercent !== undefined && (parsedCompletionPercent < 0 || parsedCompletionPercent > 100)) {
      setFormError("Completion percent must be between 0 and 100.");
      return;
    }

    if (parsedEarnedTrophies !== undefined && parsedTotalTrophies !== undefined && parsedEarnedTrophies > parsedTotalTrophies) {
      setFormError("Earned trophies cannot be higher than total trophies.");
      return;
    }

    if (parsedRating !== undefined && (parsedRating < 0 || parsedRating > 10)) {
      setFormError("Rating must be between 0 and 10.");
      return;
    }

    setFormError(null);

    onSave({
      title: trimmedTitle,
      platformIds,
      playStatus,
      trophyStatus,
      trophyProgress: {
        completionPercent: parsedCompletionPercent,
        earnedTrophies: parsedEarnedTrophies,
        totalTrophies: parsedTotalTrophies,
        platinumEarned,
        psnProfilesUrl: psnProfilesUrl.trim() || undefined,
      },
      rating: parsedRating,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form className="backlog-entry-details edit-form" onSubmit={handleSubmit}>
      <div className="details-toolbar">
        <div>
          <h3>Edit Game</h3>
          <p>Changes are stored in memory for now. Persistence comes next.</p>
        </div>

        <div className="form-actions">
          <button className="button" type="button" onClick={onCancel}>
            Cancel
          </button>

          <button className="button button--primary" type="submit">
            Save
          </button>
        </div>
      </div>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="form-grid">
        <label className="field field--wide">
          <span>Game Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="field">
          <span>Play Status</span>
          <select value={playStatus} onChange={(event) => setPlayStatus(event.target.value as PlayStatus)}>
            {playStatusOptions.map((status) => (
              <option value={status} key={status}>
                {formatPlayStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Trophy Status</span>
          <select value={trophyStatus} onChange={(event) => setTrophyStatus(event.target.value as TrophyStatus)}>
            {trophyStatusOptions.map((status) => (
              <option value={status} key={status}>
                {formatTrophyStatus(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Completion %</span>
          <input inputMode="decimal" value={completionPercent} onChange={(event) => setCompletionPercent(event.target.value)} />
        </label>

        <label className="field">
          <span>Earned Trophies</span>
          <input inputMode="numeric" value={earnedTrophies} onChange={(event) => setEarnedTrophies(event.target.value)} />
        </label>

        <label className="field">
          <span>Total Trophies</span>
          <input inputMode="numeric" value={totalTrophies} onChange={(event) => setTotalTrophies(event.target.value)} />
        </label>

        <label className="field">
          <span>Rating</span>
          <input inputMode="decimal" placeholder="0-10" value={rating} onChange={(event) => setRating(event.target.value)} />
        </label>

        <label className="field field--wide">
          <span>PSNProfiles URL</span>
          <input value={psnProfilesUrl} onChange={(event) => setPsnProfilesUrl(event.target.value)} />
        </label>

        <fieldset className="field field--wide checkbox-group">
          <legend>Platforms</legend>

          <div className="checkbox-list">
            {playstationPlatforms.map((platform) => (
              <label className="checkbox-field" key={platform.id}>
                <input type="checkbox" checked={platformIds.includes(platform.id)} onChange={() => togglePlatform(platform.id)} />
                <span>{platform.shortName}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="checkbox-field field--wide">
          <input type="checkbox" checked={platinumEarned} onChange={(event) => setPlatinumEarned(event.target.checked)} />
          <span>Platinum earned</span>
        </label>

        <label className="field field--wide">
          <span>Notes</span>
          <textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
    </form>
  );
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}
