import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-cockpit-danger flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {message}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-cockpit-danger hover:text-cockpit-danger/80 text-sm flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  );
}
