import { useState, type FormEvent } from "react";
import { IconButton } from "../../../components/ui/IconButton";
import { DeleteIcon, EditIcon, PlusIcon } from "../../../components/ui/icons";
import type { CollectionSummary } from "../../../domain/collection";
import {
  playStationPlatforms,
  playStatuses,
  playStatusLabels,
  type LibraryGame,
  type UpdateLibraryGameInput,
  type PlayStationPlatform,
  type PlayStatus,
} from "../../../domain/libraryGame";
import { GameResourceEditor } from "./GameResourceEditor";
import { LibraryTrophyAvailability } from "./LibraryTrophyAvailability";

interface LibraryGameFormProps {
  readonly initialGame: LibraryGame;
  readonly collections: readonly CollectionSummary[];
  readonly initialCollectionIds: readonly string[];
  readonly onSubmit: (
    input: UpdateLibraryGameInput,
    collectionIds: readonly string[],
  ) => Promise<void>;
  readonly onCancel: () => void;
}

export function LibraryGameForm({
  initialGame,
  collections,
  initialCollectionIds,
  onSubmit,
  onCancel,
}: LibraryGameFormProps) {
  const [title, setTitle] = useState(initialGame.title);

  const [platform, setPlatform] = useState<PlayStationPlatform>(
    initialGame.platform,
  );

  const [playStatus, setPlayStatus] = useState<PlayStatus>(
    initialGame.playStatus,
  );

  const [isUnobtainable, setIsUnobtainable] = useState(
    initialGame.isUnobtainable,
  );

  const [selectedCollectionIds, setSelectedCollectionIds] =
    useState<readonly string[]>(initialCollectionIds);

  const [notes, setNotes] = useState(initialGame.notes ?? "");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCollection(collectionId: string) {
    setSelectedCollectionIds((currentIds) =>
      currentIds.includes(collectionId)
        ? currentIds.filter((candidateId) => candidateId !== collectionId)
        : [...currentIds, collectionId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(
        {
          title: title.trim(),
          platform,
          playStatus,
          isUnobtainable,
          notes: notes.trim().length === 0 ? null : notes.trim(),
        },
        selectedCollectionIds,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasNotes = notes.trim().length > 0;

  return (
    <form className="game-form" onSubmit={handleSubmit}>
      <label className="field field--wide">
        <span>Title</span>
        <input
          data-dialog-initial-focus
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

      <fieldset className="game-form__collections" disabled={isSubmitting}>
        <legend>Collections</legend>

        <p>
          Select every Collection that should contain this game. New memberships
          are added to the end and can be reordered later.
        </p>

        {collections.length === 0 ? (
          <span className="game-form__collections-empty">
            No Collections have been created yet.
          </span>
        ) : (
          <div className="game-form__collection-options">
            {collections.map((collection) => (
              <label
                className="game-form__collection-option"
                key={collection.id}
              >
                <input
                  type="checkbox"
                  checked={selectedCollectionIds.includes(collection.id)}
                  onChange={() => toggleCollection(collection.id)}
                />

                <span>
                  <strong>{collection.name}</strong>
                  <small>
                    {collection.gameCount}{" "}
                    {collection.gameCount === 1 ? "game" : "games"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <LibraryTrophyAvailability gameId={initialGame.id} />
      <GameResourceEditor gameId={initialGame.id} />

      <section
        className="game-form__notes"
        aria-labelledby={`game-notes-heading-${initialGame.id}`}
      >
        <div className="game-form__notes-heading">
          <div>
            <strong id={`game-notes-heading-${initialGame.id}`}>Notes</strong>
            <small>Optional plans, reminders, or personal context.</small>
          </div>

          {notesExpanded ? (
            <button
              className="text-button"
              type="button"
              onClick={() => setNotesExpanded(false)}
            >
              Done
            </button>
          ) : hasNotes ? (
            <div className="game-form__notes-actions">
              <IconButton
                label="Edit game notes"
                tooltip="Edit notes"
                tooltipPlacement="top"
                tooltipAlignment="center"
                icon={<EditIcon />}
                onClick={() => setNotesExpanded(true)}
              />

              <IconButton
                label="Clear game notes"
                tooltip="Clear notes"
                tooltipPlacement="top"
                tooltipAlignment="end"
                icon={<DeleteIcon />}
                tone="danger"
                onClick={() => {
                  setNotes("");
                  setNotesExpanded(false);
                }}
              />
            </div>
          ) : (
            <button
              className="game-form__notes-add"
              type="button"
              onClick={() => setNotesExpanded(true)}
            >
              <PlusIcon />
              <span>Add notes</span>
            </button>
          )}
        </div>

        {notesExpanded ? (
          <textarea
            autoFocus
            className="game-form__notes-input"
            maxLength={10_000}
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional plans, reminders, or context"
            aria-label="Game notes"
          />
        ) : hasNotes ? (
          <p className="game-form__notes-preview">{notes}</p>
        ) : null}
      </section>

      <div className="form-actions">
        <button
          className="button button--quiet"
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
