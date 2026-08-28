import { IconButton } from "../ui/IconButton";
import { CloseIcon } from "../ui/icons";
import type { ToastRecord } from "./toastContext";

interface ToastViewportProps {
  readonly toasts: readonly ToastRecord[];
  readonly onDismiss: (toastId: string) => void;
}

function defaultTitle(toast: ToastRecord): string {
  switch (toast.tone) {
    case "success":
      return "Done";
    case "error":
      return "Something went wrong";
    case "info":
      return "Notice";
  }
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      className="toast-viewport"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <article
          className={`toast toast--${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
          key={toast.id}
        >
          <span className="toast__indicator" aria-hidden="true" />

          <div className="toast__content">
            <strong>{toast.title ?? defaultTitle(toast)}</strong>
            <p>{toast.message}</p>
          </div>

          <IconButton
            label="Dismiss notification"
            icon={<CloseIcon />}
            tooltipPlacement="bottom"
            tooltipAlignment="end"
            onClick={() => onDismiss(toast.id)}
          />
        </article>
      ))}
    </div>
  );
}
