import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type DialogSize = "small" | "medium" | "large";

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly size?: DialogSize;
  readonly dismissible?: boolean;
  readonly onClose: () => void;
}

type OpenDialogProps = Omit<DialogProps, "open">;

function OpenDialog({
  title,
  description,
  children,
  size = "medium",
  dismissible = true,
  onClose,
}: OpenDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocusedElement = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;

    if (dialog === null) {
      return;
    }

    document.body.style.overflow = "hidden";

    if (!dialog.open) {
      dialog.showModal();
    }

    dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();

    return () => {
      document.body.style.overflow = previousBodyOverflow;

      if (dialog.open) {
        dialog.close();
      }

      if (
        previouslyFocusedElement instanceof HTMLElement &&
        previouslyFocusedElement.isConnected
      ) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();

    if (dismissible) {
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissible && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-modal="true"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="dialog__panel">
        <header className="dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>

            {description === undefined ? null : (
              <p id={descriptionId}>{description}</p>
            )}
          </div>

          {dismissible ? (
            <IconButton
              label={`Close ${title}`}
              icon={<CloseIcon />}
              tooltipPlacement="bottom"
              tooltipAlignment="end"
              onClick={onClose}
            />
          ) : null}
        </header>

        <div className="dialog__body">{children}</div>
      </div>
    </dialog>
  );
}

export function Dialog(props: DialogProps) {
  if (!props.open) {
    return null;
  }

  return <OpenDialog {...props} />;
}
