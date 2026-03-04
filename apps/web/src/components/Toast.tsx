import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONFIG: Record<ToastType, { bg: string; border: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: { bg: "bg-cockpit-success/10", border: "border-cockpit-success/20", icon: CheckCircle2, iconColor: "text-cockpit-success" },
  error: { bg: "bg-cockpit-danger/10", border: "border-cockpit-danger/20", icon: AlertCircle, iconColor: "text-cockpit-danger" },
  info: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Info, iconColor: "text-blue-400" },
  warning: { bg: "bg-cockpit-accent/10", border: "border-cockpit-accent/20", icon: AlertTriangle, iconColor: "text-cockpit-accent" },
};

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: "bg-cockpit-success",
  error: "bg-cockpit-danger",
  info: "bg-blue-400",
  warning: "bg-cockpit-accent",
};

function ToastComponent({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[item.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`${config.bg} border ${config.border} rounded-lg px-4 py-3 shadow-xl min-w-[300px] max-w-[420px] relative overflow-hidden animate-[toast-slide-in_200ms_ease-out]`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.iconColor}`} />
        <span className="text-sm flex-1">{item.message}</span>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-cockpit-text-muted hover:text-cockpit-text shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${PROGRESS_COLORS[item.type]}`}
        style={{ animation: `toast-progress ${item.duration}ms linear forwards` }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => {
      const next = [...prev, { id, type, message, duration }];
      return next.length > 5 ? next.slice(-5) : next;
    });
  }, []);

  const value: ToastContextValue = {
    toast,
    success: useCallback((msg: string) => toast("success", msg), [toast]),
    error: useCallback((msg: string) => toast("error", msg), [toast]),
    info: useCallback((msg: string) => toast("info", msg), [toast]),
    warning: useCallback((msg: string) => toast("warning", msg), [toast]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2">
          {toasts.map((t) => (
            <ToastComponent key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
