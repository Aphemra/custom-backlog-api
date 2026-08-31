import { useState, type KeyboardEvent, type ReactNode } from "react";
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

  function confirm(): void {
    if (!busy && textMatches) {
      onConfirm();
    }
  }

  function handleConfirmationKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      confirm();
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
      <div className="confirmation-dialog">
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
              onKeyDown={handleConfirmationKeyDown}
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
            type="button"
            onClick={confirm}
            data-dialog-initial-focus={
              requiredText === undefined ? "" : undefined
            }
            disabled={busy || !textMatches}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) {
    return null;
  }

  return <OpenConfirmDialog {...props} />;
}
