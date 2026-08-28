import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "./toastContext";

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
