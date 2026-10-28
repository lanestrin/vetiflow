import { createContext, useContext } from "react";

// Shows a short message at the bottom of the Command Center.
export type ShowToast = (message: string) => void;

export const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const showToast = useContext(ToastContext);

  if (showToast === null) {
    throw new Error("useToast must be used inside a ToastProvider.");
  }

  return showToast;
}
