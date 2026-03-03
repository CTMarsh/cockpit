const statusColors: Record<string, string> = {
  running: "bg-cockpit-success/20 text-cockpit-success",
  online: "bg-cockpit-success/20 text-cockpit-success",
  healthy: "bg-cockpit-success/20 text-cockpit-success",
  stopped: "bg-cockpit-text-muted/20 text-cockpit-text-muted",
  offline: "bg-cockpit-text-muted/20 text-cockpit-text-muted",
  error: "bg-cockpit-danger/20 text-cockpit-danger",
  failed: "bg-cockpit-danger/20 text-cockpit-danger",
  warning: "bg-cockpit-warning/20 text-cockpit-warning",
  pending: "bg-cockpit-accent/20 text-cockpit-accent",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const color = statusColors[status.toLowerCase()] || "bg-cockpit-text-muted/20 text-cockpit-text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
