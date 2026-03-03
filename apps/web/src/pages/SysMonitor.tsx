import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  RefreshCw,
  Skull,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface Metrics {
  hostname: string;
  cpu: { percent: number; cores: number };
  memory: { totalMB: number; usedMB: number; freeMB: number; percent: number };
  disk: { mounts: { filesystem: string; mountpoint: string; totalGB: number; usedGB: number; freeGB: number; percent: number }[] };
  network: { interfaces: { name: string; rxBytes: number; txBytes: number; rxMB: number; txMB: number }[] };
  uptime: { seconds: number; formatted: string };
  loadAvg: { load1: number; load5: number; load15: number };
  timestamp: string;
}

interface Process {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  stat: string;
  start: string;
  time: string;
  command: string;
}

type SortKey = "pid" | "cpu" | "mem" | "command" | "user";

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
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={`0,${h} ${points.join(" ")} ${w},${h}`}
        fill={color}
        fillOpacity="0.1"
        stroke="none"
      />
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

export function SysMonitorPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortAsc, setSortAsc] = useState(false);
  const [killing, setKilling] = useState<number | null>(null);
  const [confirmKill, setConfirmKill] = useState<number | null>(null);

  // History for charts
  const cpuHistory = useRef<number[]>([]);
  const memHistory = useRef<number[]>([]);
  const netRxHistory = useRef<number[]>([]);
  const netTxHistory = useRef<number[]>([]);
  const prevNetRef = useRef<{ rx: number; tx: number } | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [m, p] = await Promise.all([
        api<Metrics>("/sysmon/metrics"),
        api<{ processes: Process[] }>("/sysmon/processes"),
      ]);
      setMetrics(m);
      setProcesses(p.processes || []);

      // Update histories (keep last 60 data points)
      cpuHistory.current = [...cpuHistory.current, m.cpu.percent].slice(-60);
      memHistory.current = [...memHistory.current, m.memory.percent].slice(-60);

      // Network delta calculation
      const totalRx = m.network.interfaces.reduce((s, i) => s + i.rxBytes, 0);
      const totalTx = m.network.interfaces.reduce((s, i) => s + i.txBytes, 0);
      if (prevNetRef.current) {
        const rxDelta = Math.max(0, (totalRx - prevNetRef.current.rx) / 1048576); // MB
        const txDelta = Math.max(0, (totalTx - prevNetRef.current.tx) / 1048576);
        netRxHistory.current = [...netRxHistory.current, rxDelta].slice(-60);
        netTxHistory.current = [...netTxHistory.current, txDelta].slice(-60);
      }
      prevNetRef.current = { rx: totalRx, tx: totalTx };
    } catch {
      setError("Failed to fetch system metrics");
    }
    setLoading(false);
  }

  async function killProcess(pid: number) {
    setKilling(pid);
    try {
      await api(`/sysmon/kill/${pid}`, { method: "POST" });
      setConfirmKill(null);
      setTimeout(refresh, 500);
    } catch {}
    setKilling(null);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const filteredProcesses = processes
    .filter((p) => !processFilter || p.command.toLowerCase().includes(processFilter.toLowerCase()) || p.user.toLowerCase().includes(processFilter.toLowerCase()) || String(p.pid).includes(processFilter))
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "command" || sortKey === "user") return dir * a[sortKey].localeCompare(b[sortKey]);
      return dir * ((a[sortKey] as number) - (b[sortKey] as number));
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
            System Monitor
          </h2>
          <p className="text-cockpit-text-muted mt-1">
            {metrics ? `${metrics.hostname} — up ${metrics.uptime.formatted}` : "Loading..."}
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

      {error && (
        <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-cockpit-danger flex items-center gap-2">
            <Activity className="w-4 h-4" /> {error}
          </span>
          <button onClick={refresh} className="text-cockpit-danger hover:text-cockpit-danger/80 text-sm flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {metrics && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Cpu className="w-4 h-4" /> CPU
              </div>
              <div className="text-2xl font-bold">{metrics.cpu.percent}%</div>
              <div className="text-xs text-cockpit-text-muted">{metrics.cpu.cores} cores · Load {metrics.loadAvg.load1}</div>
              <MiniChart history={cpuHistory.current} color="#c8913a" max={100} />
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <MemoryStick className="w-4 h-4" /> Memory
              </div>
              <div className="text-2xl font-bold">{metrics.memory.percent}%</div>
              <div className="text-xs text-cockpit-text-muted">{metrics.memory.usedMB}MB / {metrics.memory.totalMB}MB</div>
              <MiniChart history={memHistory.current} color="#5a9a5c" max={100} />
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Network className="w-4 h-4" /> Network RX
              </div>
              <div className="text-2xl font-bold">{netRxHistory.current.length > 0 ? netRxHistory.current[netRxHistory.current.length - 1].toFixed(1) : "0"} MB/s</div>
              <div className="text-xs text-cockpit-text-muted">{metrics.network.interfaces.length} interfaces</div>
              <MiniChart history={netRxHistory.current} color="#3b82f6" />
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Clock className="w-4 h-4" /> Uptime
              </div>
              <div className="text-2xl font-bold">{metrics.uptime.formatted}</div>
              <div className="text-xs text-cockpit-text-muted">Load: {metrics.loadAvg.load1} / {metrics.loadAvg.load5} / {metrics.loadAvg.load15}</div>
            </div>
          </div>

          {/* Disk Usage */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <HardDrive className="w-4 h-4 text-cockpit-accent" /> Disk Usage
            </h3>
            <div className="space-y-4">
              {metrics.disk.mounts.map((m) => (
                <GaugeBar
                  key={m.mountpoint}
                  percent={m.percent}
                  color={m.percent > 90 ? "#b84a3e" : m.percent > 70 ? "#c8913a" : "#5a9a5c"}
                  label={m.mountpoint}
                  detail={`${m.usedGB}GB / ${m.totalGB}GB`}
                />
              ))}
              {metrics.disk.mounts.length === 0 && (
                <p className="text-sm text-cockpit-text-muted">No disk information available</p>
              )}
            </div>
          </div>

          {/* Network Interfaces */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Network className="w-4 h-4 text-cockpit-accent" /> Network Interfaces
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.network.interfaces.map((iface) => (
                <div key={iface.name} className="bg-cockpit-bg/50 rounded-lg p-3">
                  <div className="font-mono text-sm font-medium">{iface.name}</div>
                  <div className="flex justify-between text-xs text-cockpit-text-muted mt-1">
                    <span>RX: {iface.rxMB} MB</span>
                    <span>TX: {iface.txMB} MB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Process List */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cockpit-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-cockpit-accent" /> Processes ({filteredProcesses.length})
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cockpit-text-muted" />
            <input
              type="text"
              placeholder="Filter processes..."
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              className="w-full sm:w-64 bg-cockpit-bg border border-cockpit-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-text-muted">
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("pid")}>PID <SortIcon col="pid" /></th>
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("user")}>User <SortIcon col="user" /></th>
                <th className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("cpu")}>CPU% <SortIcon col="cpu" /></th>
                <th className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("mem")}>MEM% <SortIcon col="mem" /></th>
                <th className="px-4 py-2.5 text-left font-medium cursor-pointer hover:text-cockpit-text" onClick={() => handleSort("command")}>Command <SortIcon col="command" /></th>
                <th className="px-4 py-2.5 text-center font-medium">Kill</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.slice(0, 50).map((p) => (
                <tr key={p.pid} className="border-b border-cockpit-border/30 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 font-mono text-xs">{p.pid}</td>
                  <td className="px-4 py-2 text-cockpit-text-muted">{p.user}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={p.cpu > 50 ? "text-cockpit-danger font-medium" : p.cpu > 10 ? "text-cockpit-warning" : ""}>{p.cpu}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={p.mem > 50 ? "text-cockpit-danger font-medium" : p.mem > 10 ? "text-cockpit-warning" : ""}>{p.mem}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs max-w-xs truncate">{p.command}</td>
                  <td className="px-4 py-2 text-center">
                    {confirmKill === p.pid ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => killProcess(p.pid)}
                          disabled={killing === p.pid}
                          className="px-2 py-0.5 bg-cockpit-danger/20 text-cockpit-danger rounded text-xs hover:bg-cockpit-danger/30"
                        >
                          {killing === p.pid ? "..." : "Confirm"}
                        </button>
                        <button onClick={() => setConfirmKill(null)} className="px-2 py-0.5 text-cockpit-text-muted rounded text-xs hover:bg-white/5">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmKill(p.pid)}
                        className="p-1 text-cockpit-text-muted hover:text-cockpit-danger transition-colors"
                        title="Kill process"
                      >
                        <Skull className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
