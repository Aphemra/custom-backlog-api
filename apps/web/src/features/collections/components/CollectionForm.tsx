import { useState, type FormEvent } from "react";
import { IconButton } from "../../../components/ui/IconButton";
import { CloseIcon } from "../../../components/ui/icons";
import type {
  CollectionInput,
  CollectionSummary,
} from "../../../domain/collection";

interface CollectionFormProps {
  readonly initialCollection?: CollectionSummary;
  readonly onSubmit: (input: CollectionInput) => Promise<void>;
  readonly onCancel: () => void;
}

export function CollectionForm({
  initialCollection,
  onSubmit,
  onCancel,
}: CollectionFormProps) {
  const [name, setName] = useState(initialCollection?.name ?? "");

  const [description, setDescription] = useState(
    initialCollection?.description ?? "",
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        description:
          description.trim().length === 0 ? null : description.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="collection-form" onSubmit={handleSubmit}>
      <div className="game-form__heading">
        <div>
          <p className="eyebrow">
            {initialCollection === undefined
              ? "New collection"
              : "Edit collection"}
          </p>

          <h2>
            {initialCollection === undefined
              ? "Create a collection"
              : initialCollection.name}
          </h2>
        </div>

        <IconButton
          label="Close collection editor"
          icon={<CloseIcon />}
          onClick={onCancel}
        />
      </div>

      <label className="field field--wide">
        <span>Name</span>

        <input
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Resident Evil, Final Fantasy, Quick platinums…"
        />
      </label>

      <label className="field field--wide">
        <span>Description</span>

        <textarea
          maxLength={2_000}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional context for this group"
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
            : initialCollection === undefined
              ? "Create collection"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
