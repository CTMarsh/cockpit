import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  History,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Search,
  GitBranch,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

interface DeployEvent {
  id: number;
  deployment: string;
  namespace: string;
  action: string;
  old_value: string;
  new_value: string;
  triggered_by: string;
  created_at: string;
}

interface DeployEventsResponse {
  events: DeployEvent[];
  total: number;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  scale: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  image_update: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  restart: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  rollback: {
    bg: "bg-cockpit-danger/15",
    text: "text-cockpit-danger",
    dot: "bg-cockpit-danger",
  },
};

const DEFAULT_ACTION_STYLE = {
  bg: "bg-cockpit-accent/15",
  text: "text-cockpit-accent",
  dot: "bg-cockpit-accent",
};

const PAGE_SIZE = 50;

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function DeployHistoryPage() {
  const [events, setEvents] = useState<DeployEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [namespace, setNamespace] = useState("");
  const [deployment, setDeployment] = useState("");
  const [allNamespaces, setAllNamespaces] = useState<string[]>([]);

  const fetchEvents = useCallback(
    async (currentOffset = 0, append = false) => {
      try {
        if (!append) setLoading(true);
        setError("");
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        });
        if (namespace) params.set("namespace", namespace);
        if (deployment) params.set("deployment", deployment);

        const data = await api<DeployEventsResponse>(
          `/deploy-history/events?${params}`
        );
        if (append) {
          setEvents((prev) => [...prev, ...data.events]);
        } else {
          setEvents(data.events);
        }
        setTotal(data.total);

        // Extract unique namespaces from all events seen
        if (!append && data.events.length > 0) {
          const ns = new Set<string>();
          data.events.forEach((e) => {
            if (e.namespace) ns.add(e.namespace);
          });
          setAllNamespaces((prev) => {
            const merged = new Set([...prev, ...ns]);
            return Array.from(merged).sort();
          });
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [namespace, deployment]
  );

  useEffect(() => {
    setOffset(0);
    fetchEvents(0);
  }, [fetchEvents]);

  // Fetch initial namespaces list (unfiltered) on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api<DeployEventsResponse>(
          "/deploy-history/events?limit=200&offset=0"
        );
        const ns = new Set<string>();
        data.events.forEach((e) => {
          if (e.namespace) ns.add(e.namespace);
        });
        setAllNamespaces(Array.from(ns).sort());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function loadMore() {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchEvents(newOffset, true);
  }

  const hasMore = events.length < total;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-cockpit-accent" /> Deploy History
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-cockpit-text-muted">
            {total} event{total !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => {
              setOffset(0);
              fetchEvents(0);
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setOffset(0);
            fetchEvents(0);
          }}
        />
      )}

      {/* Filter bar */}
      <div className="flex gap-3 items-center">
        <div className="relative">
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-cockpit-surface border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent min-w-[160px]"
          >
            <option value="">All Namespaces</option>
            {allNamespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-cockpit-text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-cockpit-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={deployment}
            onChange={(e) => setDeployment(e.target.value)}
            placeholder="Filter by deployment..."
            className="w-full pl-9 pr-3 py-2 bg-cockpit-surface border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {events.length > 0 && (
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-cockpit-border" />
        )}
        <div className="space-y-3">
          {events.length === 0 && !loading && (
            <div className="text-center py-12">
              <GitBranch className="w-10 h-10 text-cockpit-text-muted mx-auto mb-3 opacity-50" />
              <div className="text-cockpit-text-muted text-sm">
                No deploy events found.
              </div>
            </div>
          )}
          {events.map((event) => {
            const style =
              ACTION_STYLES[event.action] || DEFAULT_ACTION_STYLE;
            return (
              <div key={event.id} className="flex gap-4 relative">
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0 mt-4">
                  <div
                    className={`w-[8px] h-[8px] rounded-full ring-4 ring-cockpit-bg ${style.dot}`}
                    style={{ marginLeft: "8px" }}
                  />
                </div>
                {/* Event card */}
                <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-medium ${style.bg} ${style.text}`}
                      >
                        {formatAction(event.action)}
                      </span>
                      <span className="text-sm font-medium">
                        {event.deployment}
                      </span>
                      <span className="text-xs text-cockpit-text-muted px-1.5 py-0.5 bg-cockpit-bg rounded">
                        {event.namespace}
                      </span>
                    </div>
                    <span
                      className="text-xs text-cockpit-text-muted shrink-0"
                      title={new Date(event.created_at).toLocaleString()}
                    >
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                  {(event.old_value || event.new_value) && (
                    <div className="flex items-center gap-2 text-xs text-cockpit-text-muted mt-1 overflow-hidden">
                      {event.old_value && (
                        <span className="truncate max-w-[200px] font-mono bg-cockpit-bg px-1.5 py-0.5 rounded">
                          {event.old_value}
                        </span>
                      )}
                      {event.old_value && event.new_value && (
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      )}
                      {event.new_value && (
                        <span className="truncate max-w-[200px] font-mono bg-cockpit-bg px-1.5 py-0.5 rounded">
                          {event.new_value}
                        </span>
                      )}
                    </div>
                  )}
                  {event.triggered_by && (
                    <div className="text-xs text-cockpit-text-muted mt-2">
                      Triggered by{" "}
                      <span className="text-cockpit-text">
                        {event.triggered_by}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : `Load More (${events.length} of ${total})`}
          </button>
        </div>
      )}

      {loading && events.length === 0 && (
        <div className="text-center py-8 text-cockpit-text-muted text-sm">
          Loading deploy history...
        </div>
      )}
    </div>
  );
}
