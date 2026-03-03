import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Power,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
  RefreshCw,
  Send,
  AlertCircle,
} from "lucide-react";

interface WolDevice {
  id: string;
  name: string;
  mac: string;
  ip: string;
  broadcast: string;
  online: boolean;
}

export function WakeOnLanPage() {
  const [devices, setDevices] = useState<WolDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [waking, setWaking] = useState<string | null>(null);

  const [error, setError] = useState("");

  // Quick-wake state
  const [quickMac, setQuickMac] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [mac, setMac] = useState("");
  const [ip, setIp] = useState("");
  const [broadcast, setBroadcast] = useState("255.255.255.255");

  async function fetchDevices() {
    setError("");
    try {
      const d = await api<{ devices: WolDevice[] }>("/wol/devices");
      setDevices(d.devices);
    } catch {
      setError("Failed to load devices");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !mac) return;
    await api("/wol/devices", {
      method: "POST",
      body: JSON.stringify({ name, mac, ip, broadcast }),
    });
    setName("");
    setMac("");
    setIp("");
    setBroadcast("255.255.255.255");
    setShowForm(false);
    fetchDevices();
  }

  async function deleteDevice(id: string) {
    if (!confirm("Remove this device?")) return;
    await api(`/wol/devices/${id}`, { method: "DELETE" });
    fetchDevices();
  }

  async function wakeDevice(id: string) {
    setWaking(id);
    try {
      await api(`/wol/wake/${id}`, { method: "POST" });
    } catch {}
    setTimeout(() => setWaking(null), 2000);
    setTimeout(fetchDevices, 5000);
  }

  async function quickWake() {
    if (!quickMac) return;
    setWaking("quick");
    try {
      await api("/wol/wake-mac", {
        method: "POST",
        body: JSON.stringify({ mac: quickMac }),
      });
    } catch {}
    setTimeout(() => setWaking(null), 2000);
    setQuickMac("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Power className="w-6 h-6 text-cockpit-accent" />
          Wake-on-LAN
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            className="p-2 text-cockpit-text-muted hover:text-cockpit-accent rounded-lg border border-cockpit-border hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-cockpit-danger flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={fetchDevices} className="text-cockpit-danger hover:text-cockpit-danger/80 text-sm flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {/* Quick Wake */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-cockpit-accent shrink-0" />
          <span className="text-sm font-medium shrink-0">Quick Wake</span>
          <input
            type="text"
            value={quickMac}
            onChange={(e) => setQuickMac(e.target.value)}
            placeholder="AA:BB:CC:DD:EE:FF"
            className="flex-1 bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm font-mono"
          />
          <button
            onClick={quickWake}
            disabled={!quickMac || waking === "quick"}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cockpit-accent/20 text-cockpit-accent rounded-lg text-sm hover:bg-cockpit-accent/30 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {waking === "quick" ? "Sent!" : "Wake"}
          </button>
        </div>
      </div>

      {/* Add Device Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Add Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gaming PC"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">MAC Address</label>
              <input
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">IP Address (for ping check)</label>
              <input
                type="text"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Broadcast Address</label>
              <input
                type="text"
                value={broadcast}
                onChange={(e) => setBroadcast(e.target.value)}
                placeholder="255.255.255.255"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium hover:opacity-90">
              Add Device
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-cockpit-text-muted hover:text-cockpit-text text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Device Grid */}
      {devices.length === 0 && !loading ? (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-8 text-center text-cockpit-text-muted">
          No devices saved. Add a device or use Quick Wake above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.online ? "bg-cockpit-success/10" : "bg-cockpit-bg"
                  }`}>
                    {device.online ? (
                      <Wifi className="w-5 h-5 text-cockpit-success" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-cockpit-text-muted/40" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className={`text-xs ${device.online ? "text-cockpit-success" : "text-cockpit-text-muted"}`}>
                      {device.online ? "Online" : "Offline"}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteDevice(device.id)}
                  className="p-1 rounded text-cockpit-text-muted/30 hover:text-cockpit-danger opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-cockpit-text-muted mb-4">
                <div className="flex justify-between">
                  <span>MAC</span>
                  <span className="font-mono">{device.mac}</span>
                </div>
                {device.ip && (
                  <div className="flex justify-between">
                    <span>IP</span>
                    <span className="font-mono">{device.ip}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Broadcast</span>
                  <span className="font-mono">{device.broadcast}</span>
                </div>
              </div>

              <button
                onClick={() => wakeDevice(device.id)}
                disabled={waking === device.id || device.online}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  device.online
                    ? "bg-cockpit-success/10 text-cockpit-success cursor-default"
                    : waking === device.id
                    ? "bg-cockpit-accent/20 text-cockpit-accent"
                    : "bg-cockpit-accent/10 text-cockpit-accent hover:bg-cockpit-accent/20"
                }`}
              >
                <Power className="w-4 h-4" />
                {device.online ? "Already Online" : waking === device.id ? "Packet Sent!" : "Wake Up"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
