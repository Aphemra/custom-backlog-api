import { useState, type FormEvent } from "react";
import {
  playStationPlatforms,
  playStatuses,
  playStatusLabels,
  type CreateLibraryGameInput,
  type LibraryGame,
  type PlayStationPlatform,
  type PlayStatus,
} from "../../../domain/libraryGame";

interface LibraryGameFormProps {
  readonly initialGame?: LibraryGame;
  readonly onSubmit: (input: CreateLibraryGameInput) => Promise<void>;
  readonly onCancel: () => void;
}

export function LibraryGameForm({
  initialGame,
  onSubmit,
  onCancel,
}: LibraryGameFormProps) {
  const [title, setTitle] = useState(initialGame?.title ?? "");
  const [platform, setPlatform] = useState<PlayStationPlatform>(
    initialGame?.platform ?? "PS5",
  );
  const [playStatus, setPlayStatus] = useState<PlayStatus>(
    initialGame?.playStatus ?? "not_started",
  );

  const [isUnobtainable, setIsUnobtainable] = useState(
    initialGame?.isUnobtainable ?? false,
  );

  const [notes, setNotes] = useState(initialGame?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        title: title.trim(),
        platform,
        playStatus,
        isUnobtainable,
        notes: notes.trim().length === 0 ? null : notes.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="game-form" onSubmit={handleSubmit}>
      <div className="game-form__heading">
        <div>
          <p className="eyebrow">
            {initialGame === undefined ? "New entry" : "Edit entry"}
          </p>
          <h2>
            {initialGame === undefined ? "Add a game" : initialGame.title}
          </h2>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={onCancel}
          aria-label="Close form"
        >
          ×
        </button>
      </div>

      <label className="field field--wide">
        <span>Title</span>
        <input
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Game title"
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Platform</span>
          <select
            value={platform}
            onChange={(event) =>
              setPlatform(event.target.value as PlayStationPlatform)
            }
          >
            {playStationPlatforms.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Play status</span>
          <select
            value={playStatus}
            onChange={(event) =>
              setPlayStatus(event.target.value as PlayStatus)
            }
          >
            {playStatuses.map((value) => (
              <option key={value} value={value}>
                {playStatusLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="checkbox-control">
        <input
          type="checkbox"
          checked={isUnobtainable}
          onChange={(event) => setIsUnobtainable(event.target.checked)}
        />

        <span>Unobtainable — one or more trophies can no longer be earned</span>
      </label>

      <label className="field field--wide">
        <span>Notes</span>
        <textarea
          maxLength={10_000}
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional plans, reminders, or context"
        />
      </label>

      <div className="form-actions">
        <button
          className="button button--quiet"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving…"
            : initialGame === undefined
              ? "Add game"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
