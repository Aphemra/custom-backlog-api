import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

type DialogSize = "small" | "medium" | "large" | "xlarge";

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly headerActions?: ReactNode;
  readonly children: ReactNode;
  readonly size?: DialogSize;
  readonly dismissible?: boolean;
  readonly onClose: () => void;
}

type OpenDialogProps = Omit<DialogProps, "open">;

function OpenDialog({
  title,
  description,
  headerActions,
  children,
  size = "medium",
  dismissible = true,
  onClose,
}: OpenDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocusedElement = document.activeElement;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    if (dialog === null) {
      return;
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    if (!dialog.open) {
      dialog.showModal();
    }

    const requestedInitialFocus = dialog.querySelector<HTMLElement>(
      ".dialog__body [data-dialog-initial-focus]",
    );

    const fallbackInitialFocus =
      dialog.querySelector<HTMLElement>(".dialog__panel");

    (requestedInitialFocus ?? fallbackInitialFocus)?.focus();

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      document.documentElement.style.overflow = previousDocumentOverflow;
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

  function requestClose() {
    if (closing) {
      return;
    }

    setClosing(true);

    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 160;

    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, closeDelay);
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();

    if (dismissible) {
      requestClose();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (dismissible && event.target === event.currentTarget) {
      requestClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`dialog dialog--${size}${closing ? " dialog--closing" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-modal="true"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="dialog__panel" tabIndex={-1} data-dialog-initial-focus>
        <header className="dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>

            {description === undefined ? null : (
              <p id={descriptionId}>{description}</p>
            )}
          </div>

          {headerActions === undefined && !dismissible ? null : (
            <div className="dialog__header-actions">
              {headerActions}

              {dismissible ? (
                <IconButton
                  label={`Close ${title}`}
                  icon={<CloseIcon />}
                  tooltipPlacement="bottom"
                  tooltipAlignment="end"
                  onClick={requestClose}
                />
              ) : null}
            </div>
          )}
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
