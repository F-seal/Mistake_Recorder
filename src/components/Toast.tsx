import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { CloseIcon } from "./Icons";

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "error";
}

interface ToastContextValue {
  showToast: (message: string, tone?: "default" | "error") => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { copy } = useI18n();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showToast = useCallback(
    (message: string, tone: "default" | "error" = "default") => {
      clearTimer();
      const next = { id: Date.now(), message, tone };
      setToast(next);
      timerRef.current = window.setTimeout(() => {
        setToast((current) => (current?.id === next.id ? null : current));
        timerRef.current = null;
      }, tone === "error" ? 5200 : 3200);
    },
    [],
  );

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status" aria-live="polite">
          <p>{toast.message}</p>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label={copy.common.close}
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
