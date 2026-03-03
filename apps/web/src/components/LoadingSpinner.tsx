import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-cockpit-text-muted">
      <Loader2 className="w-6 h-6 animate-spin mb-3" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
