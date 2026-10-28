import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ToastContext } from "./toastContext";
import styles from "./Toast.module.scss";

// How long a message stays, as in the prototype.
export const toastDuration = 2200;

interface ToastProviderProps {
  children: ReactNode;
}

// One message at a time: a new one replaces the last and restarts the timer.
// The status region is always present, so screen readers announce each
// message politely.
export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast((current) => ({ message, id: (current?.id ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (toast === null) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), toastDuration);

    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={showToast}>
      {children}
      <div className={styles.toast} role="status" data-show={toast !== null}>
        {toast?.message}
      </div>
    </ToastContext>
  );
}
