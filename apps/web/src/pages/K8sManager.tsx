import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import {
  Box,
  RefreshCw,
  RotateCcw,
  Minus,
  Plus,
  Trash2,
  ScrollText,
  AlertTriangle,
  ChevronDown,
  X,
  Circle,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

type Tab = "workloads" | "pods" | "events";

interface Workload {
  name: string;
  namespace: string;
  type: "Deployment" | "StatefulSet" | "DaemonSet";
  ready: number;
  desired: number;
  image: string;
  age: string;
}

interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  node: string;
  age: string;
}

interface K8sEvent {
  type: string;
  reason: string;
  message: string;
  object: string;
  namespace: string;
  count: number;
  lastSeen: string;
}

function age(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function statusColor(status: string): string {
  if (status === "Running" || status === "Succeeded") return "text-cockpit-success";
  if (status === "Pending" || status === "ContainerCreating") return "text-cockpit-accent";
  return "text-cockpit-danger";
}

export function K8sManagerPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("workloads");
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNs, setSelectedNs] = useState("");
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [events, setEvents] = useState<K8sEvent[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Action states
  const [confirm, setConfirm] = useState<{ title: string; message: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [scaleTarget, setScaleTarget] = useState<{ ns: string; name: string; current: number } | null>(null);
  const [scaleValue, setScaleValue] = useState(1);
  const [logPod, setLogPod] = useState<{ ns: string; name: string } | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  const loadNamespaces = useCallback(async () => {
    try {
      const data = await api<{ available: boolean; namespaces: string[] }>("/k8s/namespaces");
      setAvailable(data.available);
      setNamespaces(data.namespaces);
    } catch {
      setAvailable(false);
    }
  }, []);

  const loadWorkloads = useCallback(async () => {
    setError("");
    try {
      const qs = selectedNs ? `?namespace=${selectedNs}` : "";
      const data = await api<{ available: boolean; workloads: Workload[] }>(`/k8s/workloads${qs}`);
      setAvailable(data.available);
      setWorkloads(data.workloads);
    } catch {
      setError("Failed to load workloads");
    }
  }, [selectedNs]);

  const loadPods = useCallback(async () => {
    setError("");
    try {
      const qs = selectedNs ? `?namespace=${selectedNs}` : "";
      const data = await api<{ available: boolean; pods: Pod[] }>(`/sysmon/pods${qs}`);
      setAvailable(data.available);
      setPods(data.pods);
    } catch {
      setError("Failed to load pods");
    }
  }, [selectedNs]);

  const loadEvents = useCallback(async () => {
    setError("");
    try {
      const qs = selectedNs ? `?namespace=${selectedNs}` : "";
      const data = await api<{ available: boolean; events: K8sEvent[] }>(`/k8s/events${qs}`);
      setAvailable(data.available);
      setEvents(data.events);
    } catch {
      setError("Failed to load events");
    }
  }, [selectedNs]);

  async function refresh() {
    setLoading(true);
    if (tab === "workloads") await loadWorkloads();
    else if (tab === "pods") await loadPods();
    else await loadEvents();
    setLoading(false);
  }

  useEffect(() => { loadNamespaces(); }, [loadNamespaces]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [tab, selectedNs]);

  // Actions
  async function restartDeployment(ns: string, name: string) {
    try {
      await api(`/k8s/deployments/${ns}/${name}/restart`, { method: "POST" });
      toast.success(`Rolling restart triggered for ${name}`);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to restart");
    }
  }

  async function scaleDeployment() {
    if (!scaleTarget) return;
    try {
      await api(`/k8s/deployments/${scaleTarget.ns}/${scaleTarget.name}/scale`, {
        method: "PATCH",
        body: JSON.stringify({ replicas: scaleValue }),
      });
      toast.success(`Scaled ${scaleTarget.name} to ${scaleValue} replicas`);
      setScaleTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to scale");
    }
  }

  async function deletePod(ns: string, name: string) {
    try {
      await api(`/k8s/pods/${ns}/${name}`, { method: "DELETE" });
      toast.success(`Pod ${name} deleted`);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete pod");
    }
  }

  async function viewLogs(ns: string, name: string) {
    if (logPod?.ns === ns && logPod?.name === name) {
      setLogPod(null);
      setLogLines([]);
      return;
    }
    setLogPod({ ns, name });
    setLogLines(["Loading..."]);
    try {
      const data = await api<{ logs: string }>(`/k8s/pods/${ns}/${name}/logs?tail=100`);
      setLogLines(data.logs ? data.logs.split("\n") : ["(no logs)"]);
      setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
    } catch {
      setLogLines(["Failed to load logs"]);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "workloads", label: "Workloads" },
    { key: "pods", label: "Pods" },
    { key: "events", label: "Events" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Box className="w-6 h-6 text-cockpit-accent" /> k3s Cluster Manager
          </h2>
          <p className="text-cockpit-text-muted mt-1">Manage workloads, pods, and cluster events</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Namespace selector */}
          <div className="relative">
            <select
              value={selectedNs}
              onChange={(e) => setSelectedNs(e.target.value)}
              className="bg-cockpit-surface border border-cockpit-border rounded-lg px-3 py-1.5 text-sm pr-8 appearance-none focus:outline-none focus:border-cockpit-accent"
            >
              <option value="">All Namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-cockpit-text-muted pointer-events-none" />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {!available && (
        <div className="bg-cockpit-accent/10 border border-cockpit-accent/20 rounded-xl p-4 text-sm">
          <AlertTriangle className="w-4 h-4 text-cockpit-accent inline mr-2" />
          Kubernetes API not available. Set <code className="bg-cockpit-bg px-1 rounded">K8S_TOKEN</code> env var or run in-cluster.
        </div>
      )}

      <ErrorBanner message={error} onRetry={refresh} />

      {/* Tabs */}
      <div className="flex border-b border-cockpit-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-cockpit-accent text-cockpit-accent"
                : "border-transparent text-cockpit-text-muted hover:text-cockpit-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "workloads" && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Namespace</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Ready</th>
                <th className="px-4 py-3 text-left font-medium">Image</th>
                <th className="px-4 py-3 text-left font-medium">Age</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => (
                <tr key={`${w.namespace}/${w.name}`} className="border-b border-cockpit-border/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs">{w.name}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted">{w.namespace}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-cockpit-bg border border-cockpit-border">{w.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={w.ready === w.desired ? "text-cockpit-success" : "text-cockpit-danger"}>
                      {w.ready}/{w.desired}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cockpit-text-muted text-xs font-mono max-w-[200px] truncate">{w.image}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted">{age(w.age)}</td>
                  <td className="px-4 py-3">
                    {w.type === "Deployment" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirm({
                            title: "Restart Deployment",
                            message: `Trigger a rolling restart of ${w.name}?`,
                            onConfirm: () => { restartDeployment(w.namespace, w.name); setConfirm(null); },
                          })}
                          className="p-1 text-cockpit-text-muted hover:text-cockpit-accent transition-colors"
                          title="Rolling restart"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setScaleTarget({ ns: w.namespace, name: w.name, current: w.desired }); setScaleValue(w.desired); }}
                          className="p-1 text-cockpit-text-muted hover:text-cockpit-accent transition-colors text-xs font-mono"
                          title="Scale replicas"
                        >
                          ⇅
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {workloads.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-cockpit-text-muted">No workloads found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "pods" && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Namespace</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Ready</th>
                  <th className="px-4 py-3 text-left font-medium">Restarts</th>
                  <th className="px-4 py-3 text-left font-medium">Node</th>
                  <th className="px-4 py-3 text-left font-medium">Age</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => (
                  <>
                    <tr key={p.name} className="border-b border-cockpit-border/50 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs">{p.name}</td>
                      <td className="px-4 py-3 text-cockpit-text-muted">{p.namespace}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 ${statusColor(p.status)}`}>
                          <Circle className="w-1.5 h-1.5 fill-current" /> {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{p.ready}</td>
                      <td className="px-4 py-3">
                        <span className={p.restarts > 5 ? "text-cockpit-danger" : ""}>{p.restarts}</span>
                      </td>
                      <td className="px-4 py-3 text-cockpit-text-muted text-xs">{p.node}</td>
                      <td className="px-4 py-3 text-cockpit-text-muted">{age(p.age)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewLogs(p.namespace, p.name)}
                            className={`p-1 transition-colors ${logPod?.name === p.name ? "text-cockpit-accent" : "text-cockpit-text-muted hover:text-cockpit-accent"}`}
                            title="View logs"
                          >
                            <ScrollText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirm({
                              title: "Delete Pod",
                              message: `Delete pod ${p.name}? A replacement will be created by its controller.`,
                              danger: true,
                              onConfirm: () => { deletePod(p.namespace, p.name); setConfirm(null); },
                            })}
                            className="p-1 text-cockpit-text-muted hover:text-cockpit-danger transition-colors"
                            title="Delete pod"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {logPod?.ns === p.namespace && logPod?.name === p.name && (
                      <tr key={`${p.name}-logs`}>
                        <td colSpan={8} className="p-0">
                          <div className="bg-cockpit-bg border-t border-cockpit-border">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-cockpit-border/50">
                              <span className="text-xs text-cockpit-text-muted font-medium">Logs — {p.name}</span>
                              <button onClick={() => { setLogPod(null); setLogLines([]); }} className="text-cockpit-text-muted hover:text-cockpit-text">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <pre
                              ref={logRef}
                              className="p-4 text-xs font-mono leading-relaxed max-h-64 overflow-auto text-cockpit-text-muted"
                            >
                              {logLines.join("\n")}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {pods.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-cockpit-text-muted">No pods found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Reason</th>
                <th className="px-4 py-3 text-left font-medium">Object</th>
                <th className="px-4 py-3 text-left font-medium">Message</th>
                <th className="px-4 py-3 text-left font-medium">Count</th>
                <th className="px-4 py-3 text-left font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className={`border-b border-cockpit-border/50 hover:bg-white/[0.02] ${e.type === "Warning" ? "bg-cockpit-danger/5" : ""}`}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                      e.type === "Warning" ? "bg-cockpit-danger/10 text-cockpit-danger" : "bg-cockpit-success/10 text-cockpit-success"
                    }`}>
                      <Circle className="w-1.5 h-1.5 fill-current" /> {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-xs">{e.reason}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted text-xs font-mono">{e.object}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted text-xs max-w-[300px] truncate">{e.message}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted">{e.count}</td>
                  <td className="px-4 py-3 text-cockpit-text-muted">{e.lastSeen ? age(e.lastSeen) : "—"}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-cockpit-text-muted">No events found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Scale Dialog */}
      {scaleTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setScaleTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl shadow-xl max-w-sm w-full p-5 pointer-events-auto">
              <h3 className="font-semibold text-sm mb-3">Scale {scaleTarget.name}</h3>
              <p className="text-sm text-cockpit-text-muted mb-4">
                Current replicas: <span className="text-cockpit-text">{scaleTarget.current}</span>
              </p>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => setScaleValue(Math.max(0, scaleValue - 1))}
                  className="p-2 bg-cockpit-bg border border-cockpit-border rounded-lg hover:border-cockpit-accent/50"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scaleValue}
                  onChange={(e) => setScaleValue(Math.min(20, Math.max(0, Number(e.target.value))))}
                  className="w-20 text-center bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
                />
                <button
                  onClick={() => setScaleValue(Math.min(20, scaleValue + 1))}
                  className="p-2 bg-cockpit-bg border border-cockpit-border rounded-lg hover:border-cockpit-accent/50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setScaleTarget(null)} className="px-4 py-2 text-sm text-cockpit-text-muted">Cancel</button>
                <button
                  onClick={scaleDeployment}
                  className="px-4 py-2 bg-cockpit-accent rounded-lg text-sm font-medium text-cockpit-bg hover:opacity-90"
                >
                  Scale to {scaleValue}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
