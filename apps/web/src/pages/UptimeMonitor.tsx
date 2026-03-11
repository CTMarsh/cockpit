import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  Signal,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  X,
  Play,
  Clock,
  ExternalLink,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface UptimeService {
  id: string;
  name: string;
  url: string;
  check_interval: number;
  expected_status: number;
  created_at: string;
  latest_check: {
    status: number;
    response_ms: number;
    error: string | null;
    checked_at: string;
  } | null;
  recent_response_ms: number[];
}

interface ServiceStats {
  uptime_pct: string;
  avg_response_ms: number;
  total_checks: number;
  checks_up: number;
}

type TimeRange = "1" | "6" | "24" | "168";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1": "1h",
  "6": "6h",
  "24": "24h",
  "168": "7d",
};

function Sparkline({ data, width = 120, height = 30 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`
    )
    .join(" ");
  return (
    <svg width={width} height={height} className="text-cockpit-accent">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

export function UptimeMonitorPage() {
  const [services, setServices] = useState<UptimeService[]>([]);
  const [stats, setStats] = useState<Record<string, ServiceStats>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState<UptimeService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UptimeService | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("24");
  const toast = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formInterval, setFormInterval] = useState(60);
  const [formExpectedStatus, setFormExpectedStatus] = useState(200);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ services: UptimeService[] }>("/uptime/services");
      setServices(data.services);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (serviceIds: string[]) => {
    const newStats: Record<string, ServiceStats> = {};
    for (const id of serviceIds) {
      try {
        const s = await api<ServiceStats>(`/uptime/stats/${id}`);
        newStats[id] = s;
      } catch {
        /* ignore individual failures */
      }
    }
    setStats(newStats);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ services: UptimeService[] }>("/uptime/services");
      setServices(data.services);
      if (data.services.length > 0) {
        await fetchStats(data.services.map((s) => s.id));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadAll, 60000);
    return () => clearInterval(interval);
  }, [loadAll]);

  function openNewForm() {
    setEditService(null);
    setFormName("");
    setFormUrl("");
    setFormInterval(60);
    setFormExpectedStatus(200);
    setShowForm(true);
  }

  function openEditForm(svc: UptimeService) {
    setEditService(svc);
    setFormName(svc.name);
    setFormUrl(svc.url);
    setFormInterval(svc.check_interval);
    setFormExpectedStatus(svc.expected_status);
    setShowForm(true);
  }

  async function saveService() {
    try {
      const body = {
        name: formName,
        url: formUrl,
        check_interval: formInterval,
        expected_status: formExpectedStatus,
      };
      if (editService) {
        await api(`/uptime/services/${editService.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Service updated");
      } else {
        await api("/uptime/services", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Service created");
      }
      setShowForm(false);
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteService() {
    if (!deleteTarget) return;
    try {
      await api(`/uptime/services/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Service deleted");
      setDeleteTarget(null);
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function checkAll() {
    try {
      setChecking(true);
      await api("/uptime/check", { method: "POST" });
      toast.success("All services checked");
      loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  }

  function isServiceUp(svc: UptimeService): boolean {
    if (!svc.latest_check) return false;
    return svc.latest_check.status === svc.expected_status;
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr + "Z");
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Signal className="w-6 h-6 text-cockpit-accent" /> Uptime Monitor
        </h2>
        <div className="flex gap-2">
          <button
            onClick={checkAll}
            disabled={checking}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <Play className={`w-4 h-4 ${checking ? "animate-pulse" : ""}`} />
            Check All
          </button>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Service
          </button>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Time range selector */}
      <div className="flex gap-1 bg-cockpit-surface border border-cockpit-border rounded-lg p-1 w-fit">
        {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              timeRange === range
                ? "bg-cockpit-accent/15 text-cockpit-accent"
                : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
            }`}
          >
            {TIME_RANGE_LABELS[range]}
          </button>
        ))}
      </div>

      {/* Service cards grid */}
      {services.length === 0 && !loading && (
        <div className="text-center text-cockpit-text-muted py-12">
          No services configured. Add one to start monitoring uptime.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((svc) => {
          const up = isServiceUp(svc);
          const svcStats = stats[svc.id];
          return (
            <div
              key={svc.id}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 space-y-3"
            >
              {/* Service header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      svc.latest_check
                        ? up
                          ? "bg-cockpit-success"
                          : "bg-cockpit-danger"
                        : "bg-cockpit-text-muted"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{svc.name}</div>
                    <a
                      href={svc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cockpit-text-muted hover:text-cockpit-accent flex items-center gap-1 truncate"
                    >
                      {svc.url}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => openEditForm(svc)}
                    title="Edit"
                    className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(svc)}
                    title="Delete"
                    className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-cockpit-text-muted uppercase tracking-wide">
                    Uptime
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      svcStats && parseFloat(svcStats.uptime_pct) >= 99
                        ? "text-cockpit-success"
                        : svcStats && parseFloat(svcStats.uptime_pct) >= 95
                        ? "text-cockpit-accent"
                        : "text-cockpit-danger"
                    }`}
                  >
                    {svcStats ? `${svcStats.uptime_pct}%` : "--"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-cockpit-text-muted uppercase tracking-wide">
                    Avg Response
                  </div>
                  <div className="text-lg font-bold">
                    {svcStats ? `${svcStats.avg_response_ms}ms` : "--"}
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              {svc.recent_response_ms.length >= 2 && (
                <div className="pt-1">
                  <Sparkline data={svc.recent_response_ms} />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] text-cockpit-text-muted pt-1 border-t border-cockpit-border">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {svc.latest_check ? formatTime(svc.latest_check.checked_at) : "Never checked"}
                </div>
                <div>
                  {svc.latest_check
                    ? svc.latest_check.error
                      ? `Error: ${svc.latest_check.error.slice(0, 30)}`
                      : `HTTP ${svc.latest_check.status} / ${svc.latest_check.response_ms}ms`
                    : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {editService ? "Edit Service" : "Add Service"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-cockpit-text-muted hover:text-cockpit-text"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="Dashboard API"
                  />
                </div>
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">URL</label>
                  <input
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="https://example.com/health"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">
                      Check Interval (s)
                    </label>
                    <input
                      type="number"
                      value={formInterval}
                      onChange={(e) => setFormInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">
                      Expected Status
                    </label>
                    <input
                      type="number"
                      value={formExpectedStatus}
                      onChange={(e) => setFormExpectedStatus(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-cockpit-text-muted hover:text-cockpit-text"
                >
                  Cancel
                </button>
                <button
                  onClick={saveService}
                  disabled={!formName || !formUrl}
                  className="px-4 py-2 text-sm bg-cockpit-accent text-white rounded-lg hover:bg-cockpit-accent/80 disabled:opacity-50"
                >
                  {editService ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Service"
          message={`Delete "${deleteTarget.name}"? This will also remove all check history.`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteService}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
