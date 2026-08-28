import { createContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  readonly tone: ToastTone;
  readonly message: string;
  readonly title?: string;
  readonly durationSeconds?: number;
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
