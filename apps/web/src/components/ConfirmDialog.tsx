import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-cockpit-surface border border-cockpit-border rounded-xl shadow-xl max-w-sm w-full mx-4 p-5">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-cockpit-text-muted hover:text-cockpit-text"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            danger ? "bg-cockpit-danger/10" : "bg-cockpit-accent/10"
          }`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? "text-cockpit-danger" : "text-cockpit-accent"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-sm text-cockpit-text-muted mt-1">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-cockpit-text-muted hover:text-cockpit-text"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              danger
                ? "bg-cockpit-danger text-white hover:opacity-90"
                : "bg-cockpit-accent text-cockpit-bg hover:opacity-90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
