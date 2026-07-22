import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Server,
  Monitor,
  Box,
  Play,
  Square,
  RotateCcw,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface PveNode {
  node: string;
  status: string;
  uptime: number;
  cpuPercent: number;
  memTotal: number;
  memUsed: number;
  memPercent: number;
  diskTotal: number;
  diskUsed: number;
}

interface PveVM {
  vmid: number;
  name: string;
  type: "qemu" | "lxc";
  status: string;
  node: string;
  cpuPercent: number;
  memMax: number;
  memUsed: number;
  memPercent: number;
  diskMax: number;
  diskUsed: number;
  uptime: number;
  tags: string;
}

interface PveStatus {
  configured: boolean;
  connected?: boolean;
  url?: string;
  message?: string;
  error?: string;
}

function UsageBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full h-2 bg-cockpit-bg rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
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

export function ProxmoxPage() {
  const [status, setStatus] = useState<PveStatus | null>(null);
  const [nodes, setNodes] = useState<PveNode[]>([]);
  const [vms, setVms] = useState<PveVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    { vmid: number; action: string; node: string; type: string; name: string } | null
  >(null);
  const toast = useToast();

  async function fetchData() {
    try {
      const [s, n, r] = await Promise.all([
        api<PveStatus>("/proxmox/status"),
        api<{ nodes: PveNode[] }>("/proxmox/nodes").catch(() => ({ nodes: [] })),
        api<{ vms: PveVM[] }>("/proxmox/resources").catch(() => ({ vms: [] })),
      ]);
      setStatus(s);
      setNodes(n.nodes);
      setVms(r.vms);
    } catch {
      setStatus({ configured: false, message: "Failed to reach API" });
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function vmAction(vmid: number, action: string, node: string, type: string) {
    setActionPending(`${vmid}-${action}`);
    try {
      await api(`/proxmox/vms/${vmid}/action`, {
        method: "POST",
        body: JSON.stringify({ action, node, type }),
      });
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} sent to ${vmid}`);
      setTimeout(fetchData, 2000);
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action} ${vmid}`);
    } finally {
      setActionPending(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-cockpit-accent animate-spin" />
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Server className="w-6 h-6 text-cockpit-accent" />
          Proxmox Dashboard
        </h2>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6">
          <div className="flex items-center gap-3 text-cockpit-warning">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Proxmox Not Configured</span>
          </div>
          <p className="text-sm text-cockpit-text-muted mt-2">
            Add these to your <code className="bg-cockpit-bg px-1.5 py-0.5 rounded">.env</code> file:
          </p>
          <pre className="mt-3 bg-cockpit-bg rounded-lg p-4 text-sm font-mono text-cockpit-text-muted">
{`PVE_URL=https://your-proxmox-host:8006
PVE_TOKEN=root@pam!cockpit=your-token-uuid`}
          </pre>
        </div>
      </div>
    );
  }

  const running = vms.filter((v) => v.status === "running").length;
  const stopped = vms.filter((v) => v.status === "stopped").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Server className="w-6 h-6 text-cockpit-accent" />
          Proxmox Dashboard
        </h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
            status.connected ? "bg-cockpit-success/10 text-cockpit-success" : "bg-cockpit-danger/10 text-cockpit-danger"
          }`}>
            <span className={`w-2 h-2 rounded-full ${status.connected ? "bg-cockpit-success" : "bg-cockpit-danger"}`} />
            {status.connected ? "Connected" : "Disconnected"}
          </span>
          <button onClick={fetchData} className="text-cockpit-text-muted hover:text-cockpit-accent">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Node Cards */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((n) => (
            <div key={n.node} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-cockpit-accent" />
                  {n.node}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  n.status === "online" ? "bg-cockpit-success/10 text-cockpit-success" : "bg-cockpit-danger/10 text-cockpit-danger"
                }`}>
                  {n.status}
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between text-cockpit-text-muted mb-1">
                    <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                    <span>{n.cpuPercent}%</span>
                  </div>
                  <UsageBar percent={n.cpuPercent} color={n.cpuPercent > 80 ? "#ef4444" : "#c49340"} />
                </div>
                <div>
                  <div className="flex justify-between text-cockpit-text-muted mb-1">
                    <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> Memory</span>
                    <span>{n.memUsed}GB / {n.memTotal}GB ({n.memPercent}%)</span>
                  </div>
                  <UsageBar percent={n.memPercent} color={n.memPercent > 80 ? "#ef4444" : "#3b82f6"} />
                </div>
                <div>
                  <div className="flex justify-between text-cockpit-text-muted mb-1">
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Disk</span>
                    <span>{n.diskUsed}GB / {n.diskTotal}GB</span>
                  </div>
                  <UsageBar percent={n.diskTotal > 0 ? (n.diskUsed / n.diskTotal) * 100 : 0} color="#8b5cf6" />
                </div>
                <div className="text-cockpit-text-muted text-xs pt-1">
                  Uptime: {formatUptime(n.uptime)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-cockpit-text-muted">
          Total: <strong className="text-cockpit-text">{vms.length}</strong> VMs/CTs
        </span>
        <span className="text-cockpit-success">{running} running</span>
        <span className="text-cockpit-text-muted">{stopped} stopped</span>
      </div>

      {/* VM/CT Table */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-cockpit-border text-cockpit-text-muted text-xs uppercase">
              <th className="text-left px-4 py-3">VMID</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Node</th>
              <th className="text-left px-4 py-3">CPU</th>
              <th className="text-left px-4 py-3">Memory</th>
              <th className="text-left px-4 py-3">Uptime</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vms.map((vm) => (
              <tr key={vm.vmid} className="border-b border-cockpit-border/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-mono text-cockpit-accent">{vm.vmid}</td>
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-2">
                    <Box className="w-3.5 h-3.5 text-cockpit-text-muted" />
                    {vm.name}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    vm.type === "lxc" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                  }`}>
                    {vm.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs ${
                    vm.status === "running" ? "text-cockpit-success" : "text-cockpit-text-muted"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      vm.status === "running" ? "bg-cockpit-success" : "bg-cockpit-text-muted"
                    }`} />
                    {vm.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-cockpit-text-muted">{vm.node}</td>
                <td className="px-4 py-3">
                  {vm.status === "running" ? (
                    <div className="w-20">
                      <UsageBar percent={vm.cpuPercent} color="#c49340" />
                      <span className="text-xs text-cockpit-text-muted">{vm.cpuPercent}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  {vm.status === "running" ? (
                    <div className="w-20">
                      <UsageBar percent={vm.memPercent} color="#3b82f6" />
                      <span className="text-xs text-cockpit-text-muted">{vm.memUsed}GB</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-cockpit-text-muted text-xs">{formatUptime(vm.uptime)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {vm.status === "stopped" ? (
                      <button
                        onClick={() => vmAction(vm.vmid, "start", vm.node, vm.type)}
                        disabled={actionPending === `${vm.vmid}-start`}
                        className="p-1.5 rounded hover:bg-cockpit-success/10 text-cockpit-success"
                        aria-label="Start"
                        title="Start"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmAction({ vmid: vm.vmid, action: "reboot", node: vm.node, type: vm.type, name: vm.name })}
                          disabled={!!actionPending}
                          className="p-1.5 rounded hover:bg-cockpit-warning/10 text-cockpit-warning"
                          aria-label="Reboot"
                          title="Reboot"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ vmid: vm.vmid, action: "shutdown", node: vm.node, type: vm.type, name: vm.name })}
                          disabled={!!actionPending}
                          className="p-1.5 rounded hover:bg-cockpit-danger/10 text-cockpit-danger"
                          aria-label="Shutdown"
                          title="Shutdown"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {vms.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-cockpit-text-muted">
                  {status.connected ? "No VMs or containers found" : "Cannot connect to Proxmox"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.action === "shutdown" ? "Shut Down VM" : "Reboot VM"}
        message={
          confirmAction
            ? `${confirmAction.action === "shutdown" ? "Shut down" : "Reboot"} "${confirmAction.name}" (${confirmAction.vmid})? Running workloads on it will be interrupted.`
            : ""
        }
        confirmLabel={confirmAction?.action === "shutdown" ? "Shut Down" : "Reboot"}
        danger
        onConfirm={() => {
          if (confirmAction) {
            vmAction(confirmAction.vmid, confirmAction.action, confirmAction.node, confirmAction.type);
            setConfirmAction(null);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
