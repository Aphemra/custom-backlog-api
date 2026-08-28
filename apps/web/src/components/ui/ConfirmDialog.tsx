import { useState, type FormEvent, type ReactNode } from "react";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly requiredText?: string;
  readonly busy?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

type OpenConfirmDialogProps = Omit<ConfirmDialogProps, "open">;

function OpenConfirmDialog({
  title,
  description,
  confirmLabel,
  requiredText,
  busy = false,
  onCancel,
  onConfirm,
}: OpenConfirmDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");

  const textMatches =
    requiredText === undefined || confirmationText === requiredText;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!busy && textMatches) {
      onConfirm();
    }
  }

  return (
    <Dialog
      open
      title={title}
      description="Review this action before continuing."
      size="small"
      dismissible={!busy}
      onClose={onCancel}
    >
      <form className="confirmation-dialog" onSubmit={handleSubmit}>
        <div className="confirmation-dialog__message">{description}</div>

        {requiredText === undefined ? null : (
          <label className="field field--wide">
            <span>
              Type <strong>{requiredText}</strong> to continue
            </span>

            <input
              data-dialog-initial-focus
              value={confirmationText}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setConfirmationText(event.target.value)}
            />
          </label>
        )}

        <div className="form-actions">
          <button
            className="button button--quiet"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            className="button button--danger"
            type="submit"
            data-dialog-initial-focus={
              requiredText === undefined ? "" : undefined
            }
            disabled={busy || !textMatches}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) {
    return null;
  }

  return <OpenConfirmDialog {...props} />;
}
