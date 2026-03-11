import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import {
  Wifi,
  RefreshCw,
  Trash2,
  Search,
  Check,
  X,
  Pencil,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface NetworkDevice {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  label: string;
  first_seen: string;
  last_seen: string;
  ports: number[];
  status: string;
}

interface ScanResult {
  scanned: number;
  found: number;
  devices: NetworkDevice[];
}

const PORT_LABELS: Record<number, string> = {
  22: "SSH",
  80: "HTTP",
  443: "HTTPS",
  3306: "MySQL",
  5432: "Postgres",
  6379: "Redis",
  8006: "Proxmox",
  8080: "Alt-HTTP",
  9000: "Traefik",
};

export function NetworkScannerPage() {
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<NetworkDevice | null>(null);
  const [scanningPort, setScanningPort] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editHostname, setEditHostname] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ devices: NetworkDevice[] }>("/network/devices");
      setDevices(data.devices);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchDevices, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  async function runScan() {
    try {
      setScanning(true);
      setError("");
      const data = await api<ScanResult>("/network/scan", { method: "POST" });
      setDevices(data.devices);
      toast.success(`Found ${data.found} devices across ${data.scanned} IPs`);
    } catch (e: any) {
      setError(e.message);
      toast.error("Scan failed: " + e.message);
    } finally {
      setScanning(false);
    }
  }

  async function runPortScan(device: NetworkDevice) {
    try {
      setScanningPort(device.id);
      const data = await api<{ ip: string; ports: number[] }>(
        `/network/portscan/${device.ip}`,
        { method: "POST" }
      );
      toast.success(`Found ${data.ports.length} open ports on ${device.ip}`);
      fetchDevices();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setScanningPort(null);
    }
  }

  function startEdit(device: NetworkDevice) {
    setEditingId(device.id);
    setEditLabel(device.label);
    setEditHostname(device.hostname);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  async function saveEdit(device: NetworkDevice) {
    try {
      await api(`/network/devices/${device.id}`, {
        method: "PUT",
        body: JSON.stringify({ label: editLabel, hostname: editHostname }),
      });
      setEditingId(null);
      fetchDevices();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function deleteDevice() {
    if (!deleteTarget) return;
    try {
      await api(`/network/devices/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Device removed");
      setDeleteTarget(null);
      fetchDevices();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wifi className="w-6 h-6 text-cockpit-accent" /> Network Scanner
        </h2>
        <div className="flex gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {scanning ? "Scanning..." : "Scan Network"}
          </button>
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Device count */}
      {devices.length > 0 && (
        <div className="text-sm text-cockpit-text-muted">
          {devices.length} device{devices.length !== 1 ? "s" : ""} tracked
          {" — "}
          {devices.filter((d) => d.status === "online").length} online
        </div>
      )}

      {/* Empty state */}
      {devices.length === 0 && !loading && (
        <div className="text-center text-cockpit-text-muted py-12">
          No devices found. Click &quot;Scan Network&quot; to discover devices.
        </div>
      )}

      {/* Device table */}
      {devices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cockpit-border text-cockpit-text-muted text-left">
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">IP Address</th>
                <th className="pb-2 pr-3 font-medium">MAC</th>
                <th className="pb-2 pr-3 font-medium">Hostname / Label</th>
                <th className="pb-2 pr-3 font-medium">Open Ports</th>
                <th className="pb-2 pr-3 font-medium">First Seen</th>
                <th className="pb-2 pr-3 font-medium">Last Seen</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr
                  key={device.id}
                  className="border-b border-cockpit-border/50 hover:bg-white/[0.02]"
                >
                  {/* Status */}
                  <td className="py-2.5 pr-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        device.status === "online"
                          ? "bg-cockpit-success"
                          : "bg-cockpit-text-muted/40"
                      }`}
                      title={device.status}
                    />
                  </td>

                  {/* IP */}
                  <td className="py-2.5 pr-3 font-mono text-xs">
                    {device.ip}
                  </td>

                  {/* MAC */}
                  <td className="py-2.5 pr-3 font-mono text-xs text-cockpit-text-muted">
                    {device.mac || "—"}
                  </td>

                  {/* Hostname / Label (editable) */}
                  <td className="py-2.5 pr-3">
                    {editingId === device.id ? (
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col gap-1">
                          <input
                            ref={editRef}
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Label"
                            className="px-2 py-0.5 text-xs bg-cockpit-bg border border-cockpit-border rounded w-32 focus:outline-none focus:border-cockpit-accent"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(device);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <input
                            value={editHostname}
                            onChange={(e) => setEditHostname(e.target.value)}
                            placeholder="Hostname"
                            className="px-2 py-0.5 text-xs bg-cockpit-bg border border-cockpit-border rounded w-32 focus:outline-none focus:border-cockpit-accent"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(device);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(device)}
                          className="p-1 text-cockpit-success hover:bg-white/5 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 text-cockpit-text-muted hover:bg-white/5 rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer group"
                        onClick={() => startEdit(device)}
                        title="Click to edit"
                      >
                        <div className="text-xs">
                          {device.label || (
                            <span className="text-cockpit-text-muted/50 italic">
                              no label
                            </span>
                          )}
                        </div>
                        {device.hostname && (
                          <div className="text-[10px] text-cockpit-text-muted">
                            {device.hostname}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Open Ports */}
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {device.ports.length === 0 && (
                        <span className="text-cockpit-text-muted/50 text-xs">
                          —
                        </span>
                      )}
                      {device.ports.map((port) => (
                        <span
                          key={port}
                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-cockpit-accent/10 text-cockpit-accent border border-cockpit-accent/20 rounded-full"
                          title={PORT_LABELS[port] || `Port ${port}`}
                        >
                          {PORT_LABELS[port] || port}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* First Seen */}
                  <td className="py-2.5 pr-3 text-xs text-cockpit-text-muted whitespace-nowrap">
                    {formatDate(device.first_seen)}
                  </td>

                  {/* Last Seen */}
                  <td className="py-2.5 pr-3 text-xs text-cockpit-text-muted whitespace-nowrap">
                    {formatDate(device.last_seen)}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => runPortScan(device)}
                        disabled={scanningPort === device.id}
                        title="Detailed port scan"
                        className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-accent hover:bg-white/5 disabled:opacity-50"
                      >
                        {scanningPort === device.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(device)}
                        title="Edit label"
                        className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(device)}
                        title="Delete"
                        className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && devices.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 animate-pulse h-12"
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Remove Device"
          message={`Remove "${deleteTarget.label || deleteTarget.ip}" from tracking? It will reappear on the next scan if still online.`}
          confirmLabel="Remove"
          onConfirm={deleteDevice}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
