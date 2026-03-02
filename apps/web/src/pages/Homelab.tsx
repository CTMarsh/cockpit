import { useEffect, useState } from "react";
import { api } from "../api";
import { RefreshCw, Circle, Server, Box, Play, Square, RotateCcw } from "lucide-react";

interface ServiceStatus {
  id: string;
  name: string;
  url: string;
  status: "up" | "down" | "unknown";
  responseTime: number | null;
  lastChecked: string;
  uptimePercent: number;
}

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string[];
}

export function HomelabPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [dockerError, setDockerError] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, up: 0, down: 0 });

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await api<any>("/homelab/services");
      setServices(data.services);
      setSummary(data.summary);
    } catch {
      // API not running yet
    }
    try {
      const data = await api<any>("/homelab/containers");
      setContainers(data.containers || []);
      setDockerError(data.error || "");
    } catch {
      setDockerError("API not available");
    }
    setLoading(false);
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUrl) return;
    await api("/homelab/services", {
      method: "POST",
      body: JSON.stringify({ name: newName, url: newUrl }),
    });
    setNewName("");
    setNewUrl("");
    refresh();
  }

  async function removeService(id: string) {
    await api(`/homelab/services/${id}`, { method: "DELETE" });
    refresh();
  }

  async function containerAction(id: string, action: "start" | "stop" | "restart") {
    await api(`/homelab/containers/${id}/${action}`, { method: "POST" });
    setTimeout(refresh, 1500);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Server className="w-6 h-6 text-cockpit-accent" />
            Homelab Dashboard
          </h2>
          <p className="text-cockpit-text-muted mt-1">Monitor your services and containers</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <div
              key={s.id}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 hover:border-cockpit-accent/30 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Circle
                    className={`w-3 h-3 fill-current ${
                      s.status === "up" ? "text-cockpit-success" : "text-cockpit-danger"
                    }`}
                  />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-cockpit-text-muted truncate max-w-[200px]">
                      {s.url}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeService(s.id)}
                  className="text-cockpit-text-muted hover:text-cockpit-danger opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                >
                  Remove
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {s.responseTime !== null && (
                  <div className="text-xs text-cockpit-text-muted">
                    Response: <span className="text-cockpit-text">{s.responseTime}ms</span>
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
                  <span className="text-xs text-cockpit-text-muted w-12 text-right">
                    {s.uptimePercent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Service Form */}
        <form onSubmit={addService} className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Service name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          />
          <input
            type="text"
            placeholder="URL (e.g., http://192.168.1.100:8080)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-[2] bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors"
          >
            Add Service
          </button>
        </form>
      </div>

      {/* Docker Containers */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Box className="w-5 h-5" />
          Docker Containers
        </h3>
        {dockerError ? (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6 text-center text-cockpit-text-muted">
            <p>{dockerError}</p>
            <p className="text-xs mt-2">
              Set DOCKER_HOST=tcp://localhost:2375 to enable Docker monitoring
            </p>
          </div>
        ) : containers.length > 0 ? (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Image</th>
                  <th className="px-4 py-3 text-left font-medium">State</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Ports</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((ct) => (
                  <tr key={ct.id} className="border-b border-cockpit-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono">{ct.name}</td>
                    <td className="px-4 py-3 text-cockpit-text-muted">{ct.image}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                          ct.state === "running"
                            ? "bg-cockpit-success/10 text-cockpit-success"
                            : "bg-cockpit-danger/10 text-cockpit-danger"
                        }`}
                      >
                        <Circle className="w-1.5 h-1.5 fill-current" />
                        {ct.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cockpit-text-muted">{ct.status}</td>
                    <td className="px-4 py-3 text-cockpit-text-muted font-mono text-xs">
                      {ct.ports?.join(", ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {ct.state !== "running" && (
                          <button
                            onClick={() => containerAction(ct.id, "start")}
                            className="p-1 text-cockpit-text-muted hover:text-cockpit-success transition-colors"
                            title="Start"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {ct.state === "running" && (
                          <button
                            onClick={() => containerAction(ct.id, "stop")}
                            className="p-1 text-cockpit-text-muted hover:text-cockpit-danger transition-colors"
                            title="Stop"
                          >
                            <Square className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => containerAction(ct.id, "restart")}
                          className="p-1 text-cockpit-text-muted hover:text-cockpit-accent transition-colors"
                          title="Restart"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6 text-center text-cockpit-text-muted">
            No containers found
          </div>
        )}
      </div>
    </div>
  );
}
