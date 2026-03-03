import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  RefreshCw,
  Server,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Box,
  Circle,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

interface ClusterMetrics {
  configured: boolean;
  message?: string;
  nodeCount: number;
  onlineCount: number;
  cpu: { cores: number; usedPercent: number };
  memory: { totalGB: number; usedGB: number; percent: number };
  disk: { totalGB: number; usedGB: number; percent: number };
  timestamp: string;
}

interface NodeMetrics {
  name: string;
  status: string;
  uptime: number;
  cpu: { cores: number; percent: number };
  memory: { totalGB: number; usedGB: number; percent: number };
  disk: { totalGB: number; usedGB: number; percent: number };
}

interface Pod {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node: string;
}

type SortKey = "name" | "namespace" | "status" | "restarts" | "node";

function MiniChart({ history, color, max }: { history: number[]; color: string; max?: number }) {
  const h = 40;
  const w = 200;
  const effectiveMax = max || Math.max(...history, 1);
  const points = history.map((v, i) => {
    const x = (i / Math.max(history.length - 1, 1)) * w;
    const y = h - (v / effectiveMax) * h;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,${h} ${points.join(" ")} ${w},${h}`} fill={color} fillOpacity="0.1" stroke="none" />
    </svg>
  );
}

function GaugeBar({ percent, color, label, detail }: { percent: number; color: string; label: string; detail: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="text-cockpit-text-muted">{detail}</span>
      </div>
      <div className="h-2.5 bg-cockpit-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </div>
      <div className="text-right text-xs text-cockpit-text-muted mt-0.5">{percent}%</div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAge(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / 60000)}m`;
}

export function SysMonitorPage() {
  const [cluster, setCluster] = useState<ClusterMetrics | null>(null);
  const [nodes, setNodes] = useState<NodeMetrics[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [podsAvailable, setPodsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [podFilter, setPodFilter] = useState("");
  const [nsFilter, setNsFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("namespace");
  const [sortAsc, setSortAsc] = useState(true);

  // History for charts
  const cpuHistory = useRef<number[]>([]);
  const memHistory = useRef<number[]>([]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [c, n, p] = await Promise.all([
        api<ClusterMetrics>("/sysmon/cluster"),
        api<{ nodes: NodeMetrics[] }>("/sysmon/nodes"),
        api<{ available: boolean; pods: Pod[] }>("/sysmon/pods"),
      ]);
      setCluster(c);
      setNodes(n.nodes || []);
      setPods(p.pods || []);
      setPodsAvailable(p.available !== false);

      if (c.configured) {
        cpuHistory.current = [...cpuHistory.current, c.cpu.usedPercent].slice(-60);
        memHistory.current = [...memHistory.current, c.memory.percent].slice(-60);
      }
    } catch {
      setError("Failed to fetch cluster metrics");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const namespaces = [...new Set(pods.map((p) => p.namespace))].sort();
  const filteredPods = pods
    .filter((p) => !nsFilter || p.namespace === nsFilter)
    .filter((p) => !podFilter || p.name.toLowerCase().includes(podFilter.toLowerCase()) || p.namespace.toLowerCase().includes(podFilter.toLowerCase()))
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "restarts") return dir * (a.restarts - b.restarts);
      return dir * (a[sortKey] || "").localeCompare(b[sortKey] || "");
    });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-6 h-6 text-cockpit-accent" />
            Cluster Monitor
          </h2>
          <p className="text-cockpit-text-muted mt-1">
            {cluster?.configured ? `${cluster.onlineCount}/${cluster.nodeCount} nodes online` : "Loading..."}
          </p>
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

      {cluster && !cluster.configured && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6">
          <div className="flex items-center gap-3 text-cockpit-warning">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Proxmox Not Configured</span>
          </div>
          <p className="text-sm text-cockpit-text-muted mt-2">
            Cluster monitoring uses Proxmox for node metrics. Add <code className="bg-cockpit-bg px-1.5 py-0.5 rounded">PVE_URL</code> and <code className="bg-cockpit-bg px-1.5 py-0.5 rounded">PVE_TOKEN</code> to your environment.
          </p>
        </div>
      )}

      {cluster?.configured && (
        <>
          {/* Cluster Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Cpu className="w-4 h-4" /> Cluster CPU
              </div>
              <div className="text-2xl font-bold">{cluster.cpu.usedPercent}%</div>
              <div className="text-xs text-cockpit-text-muted">{cluster.cpu.cores} total cores</div>
              <MiniChart history={cpuHistory.current} color="#c8913a" max={100} />
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <MemoryStick className="w-4 h-4" /> Cluster Memory
              </div>
              <div className="text-2xl font-bold">{cluster.memory.percent}%</div>
              <div className="text-xs text-cockpit-text-muted">{cluster.memory.usedGB}GB / {cluster.memory.totalGB}GB</div>
              <MiniChart history={memHistory.current} color="#5a9a5c" max={100} />
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <HardDrive className="w-4 h-4" /> Cluster Disk
              </div>
              <div className="text-2xl font-bold">{cluster.disk.percent}%</div>
              <div className="text-xs text-cockpit-text-muted">{cluster.disk.usedGB}GB / {cluster.disk.totalGB}GB</div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Server className="w-4 h-4" /> Nodes
              </div>
              <div className="text-2xl font-bold">{cluster.onlineCount}<span className="text-lg text-cockpit-text-muted">/{cluster.nodeCount}</span></div>
              <div className="text-xs text-cockpit-text-muted">
                {cluster.onlineCount === cluster.nodeCount ? "All nodes healthy" : `${cluster.nodeCount - cluster.onlineCount} offline`}
              </div>
            </div>
          </div>

          {/* Per-Node Cards */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-cockpit-accent" /> Node Resources
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <div key={node.name} className="bg-cockpit-bg/50 rounded-xl p-4 border border-cockpit-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium flex items-center gap-2">
                      <Circle className={`w-2 h-2 fill-current ${node.status === "online" ? "text-cockpit-success" : "text-cockpit-danger"}`} />
                      {node.name}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-cockpit-text-muted">
                      <Clock className="w-3 h-3" />
                      {formatUptime(node.uptime)}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <GaugeBar
                      percent={node.cpu.percent}
                      color={node.cpu.percent > 80 ? "#b84a3e" : node.cpu.percent > 50 ? "#c8913a" : "#5a9a5c"}
                      label={`CPU (${node.cpu.cores} cores)`}
                      detail={`${node.cpu.percent}%`}
                    />
                    <GaugeBar
                      percent={node.memory.percent}
                      color={node.memory.percent > 80 ? "#b84a3e" : node.memory.percent > 60 ? "#c8913a" : "#5a9a5c"}
                      label="Memory"
                      detail={`${node.memory.usedGB}GB / ${node.memory.totalGB}GB`}
                    />
                    <GaugeBar
                      percent={node.disk.percent}
                      color={node.disk.percent > 90 ? "#b84a3e" : node.disk.percent > 70 ? "#c8913a" : "#5a9a5c"}
                      label="Disk"
                      detail={`${node.disk.usedGB}GB / ${node.disk.totalGB}GB`}
                    />
                  </div>
                </div>
              ))}
              {nodes.length === 0 && (
                <p className="text-sm text-cockpit-text-muted col-span-full">No node data available</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pod List */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cockpit-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Box className="w-4 h-4 text-cockpit-accent" /> Pods ({filteredPods.length})
          </h3>
          <div className="flex items-center gap-2">
            {namespaces.length > 1 && (
              <select
                value={nsFilter}
                onChange={(e) => setNsFilter(e.target.value)}
                className="bg-cockpit-bg border border-cockpit-border rounded-lg px-2 py-2 text-sm"
              >
                <option value="">All namespaces</option>
                {namespaces.map((ns) => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cockpit-text-muted" />
              <input
                type="text"
                placeholder="Filter pods..."
                value={podFilter}
                onChange={(e) => setPodFilter(e.target.value)}
                className="w-full sm:w-56 bg-cockpit-bg border border-cockpit-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
              />
            </div>
          </div>
        </div>

        {!podsAvailable && (
          <div className="px-4 py-3 bg-cockpit-warning/5 border-b border-cockpit-border text-sm text-cockpit-warning flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Kubernetes API not available. Pod data requires in-cluster access or K8S_TOKEN configuration.
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("namespace")}>Namespace <SortIcon col="namespace" /></th>
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("name")}>Name <SortIcon col="name" /></th>
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("status")}>Status <SortIcon col="status" /></th>
                <th className="px-4 py-2.5 text-center font-medium">Ready</th>
                <th className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("restarts")}>Restarts <SortIcon col="restarts" /></th>
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("node")}>Node <SortIcon col="node" /></th>
                <th className="px-4 py-2.5 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {filteredPods.map((p) => (
                <tr key={`${p.namespace}/${p.name}`} className="border-b border-cockpit-border/30 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-cockpit-text-muted text-xs">{p.namespace}</td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${
                      p.status === "Running" ? "text-cockpit-success" :
                      p.status === "Succeeded" ? "text-cockpit-text-muted" :
                      p.status === "Pending" ? "text-cockpit-warning" :
                      "text-cockpit-danger"
                    }`}>
                      <Circle className={`w-1.5 h-1.5 fill-current`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-xs">{p.ready}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={p.restarts > 10 ? "text-cockpit-danger font-medium" : p.restarts > 0 ? "text-cockpit-warning" : "text-cockpit-text-muted"}>
                      {p.restarts}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-cockpit-text-muted text-xs">{p.node}</td>
                  <td className="px-4 py-2 text-right text-xs text-cockpit-text-muted">{formatAge(p.age)}</td>
                </tr>
              ))}
              {filteredPods.length === 0 && podsAvailable && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-cockpit-text-muted">
                    {podFilter || nsFilter ? "No pods match your filter" : "No pods found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
