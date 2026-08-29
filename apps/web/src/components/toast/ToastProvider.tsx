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
import { requestSettingsNavigation } from "../../features/settings/settingsNavigation";
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

const npssoReminderStorageKey = "trophy-backlog:npsso-renewal-reminder-date";

const millisecondsPerDay = 24 * 60 * 60 * 1_000;

function localCalendarDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function reminderWasShownToday(today: string): boolean {
  try {
    return window.localStorage.getItem(npssoReminderStorageKey) === today;
  } catch {
    return false;
  }
}

function rememberReminderDate(today: string): void {
  try {
    window.localStorage.setItem(npssoReminderStorageKey, today);
  } catch {
    // The reminder still works when browser storage is unavailable;
    // it simply cannot suppress another notification after a reload.
  }
}

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
  const credentialReminderCheckedRef = useRef(false);

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
    if (credentialReminderCheckedRef.current) {
      return;
    }

    credentialReminderCheckedRef.current = true;

    const controller = new AbortController();

    void settingsApi
      .getPlayStation(controller.signal)
      .then((settings) => {
        if (
          controller.signal.aborted ||
          !settings.hasNpsso ||
          settings.npssoExpectedRenewalAt === null
        ) {
          return;
        }

        const now = new Date();
        const expectedRenewal = new Date(settings.npssoExpectedRenewalAt);

        if (Number.isNaN(expectedRenewal.getTime())) {
          return;
        }

        const reminderBeginsAt =
          expectedRenewal.getTime() -
          settings.renewalReminderDays * millisecondsPerDay;

        if (now.getTime() < reminderBeginsAt) {
          return;
        }

        const today = localCalendarDate(now);

        if (reminderWasShownToday(today)) {
          return;
        }

        rememberReminderDate(today);

        const remainingMilliseconds = expectedRenewal.getTime() - now.getTime();

        const daysRemaining = Math.max(
          0,
          Math.ceil(remainingMilliseconds / millisecondsPerDay),
        );

        const renewalIsDue = remainingMilliseconds <= 0;

        showToast({
          tone: renewalIsDue ? "error" : "info",
          title: renewalIsDue
            ? "Reader NPSSO renewal expected"
            : "Reader NPSSO renewal approaching",
          message: renewalIsDue
            ? "The stored reader-account NPSSO has reached its estimated renewal date. Replace it before the next trophy synchronization."
            : `The reader-account NPSSO is expected to need replacement in approximately ${daysRemaining} ${
                daysRemaining === 1 ? "day" : "days"
              }.`,
          durationSeconds: 15,
          action: {
            label: "Open Settings",
            onSelect: requestSettingsNavigation,
          },
        });
      })
      .catch(() => {
        // Credential reminders should never prevent the app from loading.
      });

    return () => controller.abort();
  }, [showToast]);

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
