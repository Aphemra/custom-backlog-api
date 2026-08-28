import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { settingsApi } from "../../services/api/settingsApi";
import { applyAppearanceSettings } from "../../features/settings/appearanceSettings";
import {
  ToastContext,
  type ToastInput,
  type ToastRecord,
} from "./toastContext";
import { ToastViewport } from "./ToastViewport";

interface ToastProviderProps {
  readonly children: ReactNode;
}

const defaultNotificationDurationSeconds = 5;
const maximumVisibleToasts = 5;

function normalizeDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return defaultNotificationDurationSeconds;
  }

  return Math.min(60, Math.max(1, Math.round(seconds)));
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  const [notificationDurationSeconds, setStoredNotificationDurationSeconds] =
    useState(defaultNotificationDurationSeconds);

  const timersRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((toastId: string) => {
    const timer = timersRef.current.get(toastId);

    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(toastId);
    }

    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }, []);

  const showToast = useCallback(
    (input: ToastInput): string => {
      const toastId = crypto.randomUUID();
      const toast: ToastRecord = {
        ...input,
        id: toastId,
      };

      setToasts((currentToasts) => [
        ...currentToasts.slice(-(maximumVisibleToasts - 1)),
        toast,
      ]);

      const durationSeconds = normalizeDuration(
        input.durationSeconds ?? notificationDurationSeconds,
      );

      const timer = window.setTimeout(() => {
        dismissToast(toastId);
      }, durationSeconds * 1_000);

      timersRef.current.set(toastId, timer);

      return toastId;
    },
    [dismissToast, notificationDurationSeconds],
  );

  const setNotificationDurationSeconds = useCallback((seconds: number) => {
    setStoredNotificationDurationSeconds(normalizeDuration(seconds));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void settingsApi
      .get(controller.signal)
      .then((settings) => {
        if (!controller.signal.aborted) {
          setStoredNotificationDurationSeconds(
            normalizeDuration(settings.notificationDurationSeconds),
          );

          applyAppearanceSettings(settings);
        }
      })
      .catch(() => {
        // Keep the safe five-second default if Settings cannot be loaded.
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      showToast,
      dismissToast,
      notificationDurationSeconds,
      setNotificationDurationSeconds,
    }),
    [
      dismissToast,
      notificationDurationSeconds,
      setNotificationDurationSeconds,
      showToast,
    ],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
