import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { pveTls } from "../tls-config";

export const proxmoxRoutes = new OpenAPIHono();

const PVE_URL = process.env.PVE_URL || "";
const PVE_TOKEN = process.env.PVE_TOKEN || "";

async function pveApi(path: string, method = "GET", body?: any): Promise<any> {
  if (!PVE_URL || !PVE_TOKEN) {
    throw new Error("Proxmox not configured. Set PVE_URL and PVE_TOKEN env vars.");
  }
  const res = await fetch(`${PVE_URL}/api2/json${path}`, {
    method,
    headers: { Authorization: `PVEAPIToken=${PVE_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore — Bun supports this
    tls: pveTls(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxmox API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.data;
}

const statusRoute = createRoute({
  method: 'get', path: '/status', tags: ['Proxmox'],
  description: 'Check Proxmox connection status',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Connection status' } }
});
proxmoxRoutes.openapi(statusRoute, async (c) => {
  if (!PVE_URL || !PVE_TOKEN) return c.json({ configured: false, message: "Set PVE_URL and PVE_TOKEN in .env" }, 200);
  try {
    await pveApi("/version");
    return c.json({ configured: true, url: PVE_URL, connected: true }, 200);
  } catch (e: any) {
    return c.json({ configured: true, url: PVE_URL, connected: false, error: e.message }, 200);
  }
});

const nodesRoute = createRoute({
  method: 'get', path: '/nodes', tags: ['Proxmox'],
  description: 'List Proxmox nodes with stats',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Node list' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
proxmoxRoutes.openapi(nodesRoute, async (c) => {
  try {
    const nodes = await pveApi("/nodes");
    return c.json({
      nodes: nodes.map((n: any) => ({
        node: n.node, status: n.status, uptime: n.uptime,
        cpuPercent: Math.round((n.cpu || 0) * 1000) / 10,
        memTotal: Math.round((n.maxmem || 0) / 1073741824 * 10) / 10,
        memUsed: Math.round((n.mem || 0) / 1073741824 * 10) / 10,
        memPercent: n.maxmem ? Math.round((n.mem / n.maxmem) * 1000) / 10 : 0,
        diskTotal: Math.round((n.maxdisk || 0) / 1073741824 * 10) / 10,
        diskUsed: Math.round((n.disk || 0) / 1073741824 * 10) / 10,
      })),
    } as any, 200);
  } catch (e: any) {
    return c.json({ nodes: [], error: e.message } as any, 500);
  }
});

const resourcesRoute = createRoute({
  method: 'get', path: '/resources', tags: ['Proxmox'],
  description: 'List all VMs and containers',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'VM/CT list' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
proxmoxRoutes.openapi(resourcesRoute, async (c) => {
  try {
    const resources = await pveApi("/cluster/resources?type=vm");
    const vms = resources.map((r: any) => ({
      vmid: r.vmid, name: r.name || `VM ${r.vmid}`, type: r.type, status: r.status, node: r.node,
      cpuPercent: Math.round((r.cpu || 0) * 1000) / 10,
      memMax: Math.round((r.maxmem || 0) / 1073741824 * 10) / 10,
      memUsed: Math.round((r.mem || 0) / 1073741824 * 10) / 10,
      memPercent: r.maxmem ? Math.round((r.mem / r.maxmem) * 1000) / 10 : 0,
      diskMax: Math.round((r.maxdisk || 0) / 1073741824 * 10) / 10,
      diskUsed: Math.round((r.disk || 0) / 1073741824 * 10) / 10,
      uptime: r.uptime || 0, tags: r.tags || "",
    }));
    vms.sort((a: any, b: any) => a.vmid - b.vmid);
    return c.json({ vms } as any, 200);
  } catch (e: any) {
    return c.json({ vms: [], error: e.message } as any, 500);
  }
});

const vmActionRoute = createRoute({
  method: 'post', path: '/vms/{vmid}/action', tags: ['Proxmox'],
  description: 'Start/stop/reboot a VM or CT',
  request: {
    params: z.object({ vmid: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ action: z.string(), node: z.string(), type: z.string() }) } } }
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), vmid: z.number(), action: z.string(), taskId: z.any() }) } }, description: 'Action performed' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    500: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Proxmox error' },
  }
});
proxmoxRoutes.openapi(vmActionRoute, async (c) => {
  const vmid = parseInt(c.req.valid('param').vmid);
  if (isNaN(vmid) || vmid < 100 || vmid > 999999) return c.json({ error: "Invalid VMID" } as any, 400);
  const { action, node, type } = c.req.valid('json');
  if (!node || !/^[a-zA-Z0-9\-]{1,64}$/.test(node)) return c.json({ error: "Invalid node name" } as any, 400);
  if (!["start", "stop", "reboot", "shutdown", "reset"].includes(action)) return c.json({ error: "Invalid action. Use: start, stop, reboot, shutdown, reset" } as any, 400);
  const vmType = type === "lxc" ? "lxc" : "qemu";
  const endpoint = action === "reboot" && vmType === "qemu" ? "reset" : action === "reboot" && vmType === "lxc" ? "reboot" : action;
  try {
    const result = await pveApi(`/nodes/${node}/${vmType}/${vmid}/status/${endpoint}`, "POST");
    return c.json({ ok: true, vmid, action, taskId: result }, 200);
  } catch (e: any) {
    return c.json({ error: e.message } as any, 500);
  }
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Proxmox'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
proxmoxRoutes.openapi(healthRoute, (c) => c.json({ module: "proxmox", status: "ok" }, 200));
