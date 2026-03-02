import { Hono } from "hono";

export const proxmoxRoutes = new Hono();

const PVE_URL = process.env.PVE_URL || "";
const PVE_TOKEN = process.env.PVE_TOKEN || "";
// Token format: USER@REALM!TOKENID=SECRET e.g. root@pam!cockpit=uuid-here

async function pveApi(path: string, method = "GET", body?: any): Promise<any> {
  if (!PVE_URL || !PVE_TOKEN) {
    throw new Error("Proxmox not configured. Set PVE_URL and PVE_TOKEN env vars.");
  }

  const res = await fetch(`${PVE_URL}/api2/json${path}`, {
    method,
    headers: {
      Authorization: `PVEAPIToken=${PVE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    // Proxmox uses self-signed certs by default
    // @ts-ignore — Bun supports this
    tls: { rejectUnauthorized: false },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxmox API ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.data;
}

// GET /api/proxmox/status — connection status
proxmoxRoutes.get("/status", async (c) => {
  if (!PVE_URL || !PVE_TOKEN) {
    return c.json({ configured: false, message: "Set PVE_URL and PVE_TOKEN in .env" });
  }
  try {
    await pveApi("/version");
    return c.json({ configured: true, url: PVE_URL, connected: true });
  } catch (e: any) {
    return c.json({ configured: true, url: PVE_URL, connected: false, error: e.message });
  }
});

// GET /api/proxmox/nodes — list nodes with stats
proxmoxRoutes.get("/nodes", async (c) => {
  try {
    const nodes = await pveApi("/nodes");
    return c.json({
      nodes: nodes.map((n: any) => ({
        node: n.node,
        status: n.status,
        uptime: n.uptime,
        cpuPercent: Math.round((n.cpu || 0) * 1000) / 10,
        memTotal: Math.round((n.maxmem || 0) / 1073741824 * 10) / 10,
        memUsed: Math.round((n.mem || 0) / 1073741824 * 10) / 10,
        memPercent: n.maxmem ? Math.round((n.mem / n.maxmem) * 1000) / 10 : 0,
        diskTotal: Math.round((n.maxdisk || 0) / 1073741824 * 10) / 10,
        diskUsed: Math.round((n.disk || 0) / 1073741824 * 10) / 10,
      })),
    });
  } catch (e: any) {
    return c.json({ nodes: [], error: e.message }, 500);
  }
});

// GET /api/proxmox/resources — list all VMs and CTs
proxmoxRoutes.get("/resources", async (c) => {
  try {
    const resources = await pveApi("/cluster/resources?type=vm");
    const vms = resources.map((r: any) => ({
      vmid: r.vmid,
      name: r.name || `VM ${r.vmid}`,
      type: r.type, // "qemu" or "lxc"
      status: r.status,
      node: r.node,
      cpuPercent: Math.round((r.cpu || 0) * 1000) / 10,
      memMax: Math.round((r.maxmem || 0) / 1073741824 * 10) / 10,
      memUsed: Math.round((r.mem || 0) / 1073741824 * 10) / 10,
      memPercent: r.maxmem ? Math.round((r.mem / r.maxmem) * 1000) / 10 : 0,
      diskMax: Math.round((r.maxdisk || 0) / 1073741824 * 10) / 10,
      diskUsed: Math.round((r.disk || 0) / 1073741824 * 10) / 10,
      uptime: r.uptime || 0,
      tags: r.tags || "",
    }));
    vms.sort((a: any, b: any) => a.vmid - b.vmid);
    return c.json({ vms });
  } catch (e: any) {
    return c.json({ vms: [], error: e.message }, 500);
  }
});

// POST /api/proxmox/vms/:vmid/action — start/stop/reboot a VM or CT
proxmoxRoutes.post("/vms/:vmid/action", async (c) => {
  const vmid = parseInt(c.req.param("vmid"));
  const { action, node, type } = await c.req.json<{ action: string; node: string; type: string }>();

  if (!["start", "stop", "reboot", "shutdown", "reset"].includes(action)) {
    return c.json({ error: "Invalid action. Use: start, stop, reboot, shutdown, reset" }, 400);
  }

  const vmType = type === "lxc" ? "lxc" : "qemu";
  const endpoint = action === "reboot" && vmType === "qemu" ? "reset" :
                   action === "reboot" && vmType === "lxc" ? "reboot" : action;

  try {
    const result = await pveApi(`/nodes/${node}/${vmType}/${vmid}/status/${endpoint}`, "POST");
    return c.json({ ok: true, vmid, action, taskId: result });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/proxmox/health
proxmoxRoutes.get("/health", (c) => c.json({ module: "proxmox", status: "ok" }));
