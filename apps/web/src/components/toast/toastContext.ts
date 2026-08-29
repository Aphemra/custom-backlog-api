import { createContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastAction {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface ToastInput {
  readonly tone: ToastTone;
  readonly message: string;
  readonly title?: string;
  readonly durationSeconds?: number;
  readonly action?: ToastAction;
}

export interface ToastRecord extends ToastInput {
  readonly id: string;
}

export interface ToastContextValue {
  readonly showToast: (input: ToastInput) => string;
  readonly dismissToast: (toastId: string) => void;
  readonly notificationDurationSeconds: number;
  readonly setNotificationDurationSeconds: (seconds: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
