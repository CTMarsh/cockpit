import { useEffect, useState } from "react";
import { api } from "../api";
import { RefreshCw, Circle, Server, Pencil, Check, Trash2 } from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface ServiceStatus {
  id: string;
  name: string;
  url: string;
  status: "up" | "down" | "unknown";
  responseTime: number | null;
  lastChecked: string;
  uptimePercent: number;
  statusCode: number | null;
}


function Sparkline({ data }: { data: { status: string }[] }) {
  if (!data.length) return null;
  const points = data.slice(0, 48).reverse(); // last 24h at ~30min intervals
  const w = 60, h = 16;
  const segW = w / Math.max(points.length - 1, 1);
  return (
    <svg width={w} height={h} className="shrink-0" aria-label="Uptime sparkline">
      {points.map((p, i) => (
        <rect
          key={i}
          x={i * segW}
          y={0}
          width={Math.max(segW - 0.5, 1)}
          height={h}
          className={p.status === "up" ? "fill-cockpit-success/60" : "fill-cockpit-danger/60"}
        />
      ))}
    </svg>
  );
}

export function HomelabPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({ total: 0, up: 0, down: 0 });
  const [sparklines, setSparklines] = useState<Record<string, { status: string }[]>>({});

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const toast = useToast();

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await api<any>("/homelab/services");
      setServices(data.services);
      setSummary(data.summary);
    } catch {
      setError("Failed to load services");
    }
    setLoading(false);
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUrl) return;
    try {
      await api("/homelab/services", {
        method: "POST",
        body: JSON.stringify({ name: newName, url: newUrl }),
      });
      setNewName("");
      setNewUrl("");
      toast.success("Service added");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add service");
    }
  }

  async function removeService(id: string) {
    try {
      await api(`/homelab/services/${id}`, { method: "DELETE" });
      toast.success("Service removed");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove service");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  function startEdit(s: ServiceStatus) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditUrl(s.url);
  }

  async function saveEdit(id: string) {
    try {
      await api(`/homelab/services/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName, url: editUrl }),
      });
      setEditingId(null);
      toast.success("Service updated");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update service");
    }
  }

  // Fetch sparkline history for all services
  useEffect(() => {
    if (services.length === 0) return;
    Promise.all(
      services.map((s) =>
        api<{ history: { status: string }[] }>(`/homelab/services/${s.id}/history?limit=48`)
          .then((d) => [s.id, d.history] as const)
          .catch(() => [s.id, [] as { status: string }[]] as const)
      )
    ).then((results) => {
      const map: Record<string, { status: string }[]> = {};
      for (const [id, history] of results) map[id] = history;
      setSparklines(map);
    });
  }, [services]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Server className="w-6 h-6 text-cockpit-accent" />
            Homelab Dashboard
          </h2>
          <p className="text-cockpit-text-muted mt-1">Monitor your homelab services</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <ErrorBanner message={error} onRetry={refresh} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="text-cockpit-text-muted text-sm">Total Services</div>
          <div className="text-3xl font-bold mt-1">{summary.total}</div>
        </div>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="text-cockpit-success text-sm">Online</div>
          <div className="text-3xl font-bold mt-1 text-cockpit-success">{summary.up}</div>
        </div>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="text-cockpit-danger text-sm">Offline</div>
          <div className="text-3xl font-bold mt-1 text-cockpit-danger">{summary.down}</div>
        </div>
      </div>

      {/* Service Grid */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Services</h3>
        {!loading && services.length === 0 && (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-8 text-center text-cockpit-text-muted mb-4">
            No services yet. Add one below to start monitoring your homelab.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 hover:border-cockpit-accent/30 transition-colors group"
            >
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="Service name"
                  />
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="URL"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s.id)} className="flex items-center gap-1 px-3 py-1 bg-cockpit-accent rounded-lg text-xs"><Check className="w-3 h-3" /> Save</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-cockpit-text-muted text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Circle className={`w-3 h-3 fill-current ${s.status === "up" ? "text-cockpit-success" : "text-cockpit-danger"}`} />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-cockpit-text-muted truncate max-w-[200px]">{s.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(s)} className="text-cockpit-text-muted hover:text-cockpit-accent text-xs p-1" aria-label="Edit service" title="Edit"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => setConfirmDeleteId(s.id)} className="text-cockpit-text-muted hover:text-cockpit-danger text-xs p-1" aria-label="Remove service" title="Remove"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {s.responseTime !== null && (
                      <div className="text-xs text-cockpit-text-muted">
                        Response: <span className="text-cockpit-text">{s.responseTime}ms</span>
                        {s.statusCode && <span className="ml-2 opacity-60">({s.statusCode})</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-cockpit-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            s.uptimePercent >= 99 ? "bg-cockpit-success" :
                            s.uptimePercent >= 95 ? "bg-cockpit-warning" : "bg-cockpit-danger"
                          }`}
                          style={{ width: `${s.uptimePercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-cockpit-text-muted w-12 text-right">{s.uptimePercent}%</span>
                    </div>
                    {sparklines[s.id]?.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Sparkline data={sparklines[s.id]} />
                        <span className="text-[10px] text-cockpit-text-muted">24h</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add Service Form */}
        <form onSubmit={addService} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Service name" value={newName} onChange={(e) => setNewName(e.target.value)}
              className="flex-1 bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent" />
            <input type="text" placeholder="URL (e.g., http://192.168.1.100:8080)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 sm:flex-[2] bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent" />
          </div>
          <button type="submit" className="w-full sm:w-auto px-5 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors">
            Add Service
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Remove Service"
        message="This will stop monitoring this service and remove its history. This cannot be undone."
        confirmLabel="Remove"
        danger
        onConfirm={() => confirmDeleteId && removeService(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
