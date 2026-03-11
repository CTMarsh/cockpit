import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const networkRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS network_devices (id TEXT PRIMARY KEY, ip TEXT NOT NULL, mac TEXT NOT NULL DEFAULT '', hostname TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', first_seen TEXT NOT NULL DEFAULT (datetime('now')), last_seen TEXT NOT NULL DEFAULT (datetime('now')), ports TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'unknown')`);
db.run(`CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip)`);

const stmts = {
  listDevices: db.prepare("SELECT * FROM network_devices ORDER BY ip"),
  getDeviceByIp: db.prepare("SELECT * FROM network_devices WHERE ip = ?"),
  getDevice: db.prepare("SELECT * FROM network_devices WHERE id = ?"),
  insertDevice: db.prepare("INSERT INTO network_devices (id, ip, mac, hostname, label, ports, status) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  upsertDevice: db.prepare(`INSERT INTO network_devices (id, ip, mac, hostname, label, ports, status, first_seen, last_seen) VALUES (?, ?, '', '', '', ?, 'online', datetime('now'), datetime('now')) ON CONFLICT(id) DO UPDATE SET ports = excluded.ports, status = 'online', last_seen = datetime('now')`),
  updateDevice: db.prepare("UPDATE network_devices SET label = ?, hostname = ? WHERE id = ?"),
  updatePorts: db.prepare("UPDATE network_devices SET ports = ?, last_seen = datetime('now') WHERE id = ?"),
  deleteDevice: db.prepare("DELETE FROM network_devices WHERE id = ?"),
  markOffline: db.prepare("UPDATE network_devices SET status = 'offline' WHERE id = ?"),
};

const COMMON_PORTS = [22, 80, 443, 8006, 8080, 9000, 3000, 4000, 4100, 5050, 6443];
const DETAILED_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 9090];

async function checkPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    try { Bun.connect({ hostname: host, port, socket: { open(socket) { clearTimeout(timer); socket.end(); resolve(true); }, error() { clearTimeout(timer); resolve(false); }, close() {}, data() {} } }); }
    catch { clearTimeout(timer); resolve(false); }
  });
}

async function withConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) { const p = fn(item).then(() => { executing.delete(p); }); executing.add(p); if (executing.size >= limit) await Promise.race(executing); }
  await Promise.all(executing);
}

const listRoute = createRoute({ method: 'get', path: '/devices', tags: ['Network'], description: 'List all known devices', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Device list' } } });
networkRoutes.openapi(listRoute, (c) => {
  const devices = stmts.listDevices.all() as any[];
  return c.json({ devices: devices.map((d) => ({ ...d, ports: JSON.parse(d.ports || "[]") })) }, 200);
});

const scanRoute = createRoute({ method: 'post', path: '/scan', tags: ['Network'], description: 'Scan 10.0.80.0/24 network', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Scan results' } } });
networkRoutes.openapi(scanRoute, async (c) => {
  const ips: string[] = []; for (let i = 1; i <= 255; i++) ips.push(`10.0.80.${i}`);
  const existing = stmts.listDevices.all() as any[];
  for (const dev of existing) stmts.markOffline.run(dev.id);
  const found: Array<{ ip: string; ports: number[] }> = [];
  await withConcurrency(ips, 50, async (ip) => {
    const quickProbe = await Promise.all([checkPort(ip, 80, 2000), checkPort(ip, 443, 2000)]);
    if (!quickProbe.some(Boolean)) return;
    const portResults = await Promise.all(COMMON_PORTS.map(async (port) => ({ port, open: await checkPort(ip, port, 2000) })));
    const openPorts = portResults.filter((r) => r.open).map((r) => r.port);
    const id = `net-${ip.replace(/\./g, "-")}`;
    stmts.upsertDevice.run(id, ip, JSON.stringify(openPorts));
    found.push({ ip, ports: openPorts });
  });
  const devices = stmts.listDevices.all() as any[];
  return c.json({ scanned: ips.length, found: found.length, devices: devices.map((d) => ({ ...d, ports: JSON.parse(d.ports || "[]") })) } as any, 200);
});

const portscanRoute = createRoute({ method: 'post', path: '/portscan/{ip}', tags: ['Network'], description: 'Detailed port scan on a single IP', request: { params: z.object({ ip: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Port scan results' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Invalid IP' } } });
networkRoutes.openapi(portscanRoute, async (c) => {
  const ip = c.req.valid('param').ip;
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return c.json({ error: "Invalid IP address" } as any, 400);
  const results = await Promise.all(DETAILED_PORTS.map(async (port) => ({ port, open: await checkPort(ip, port, 2000) })));
  const openPorts = results.filter((r) => r.open).map((r) => r.port);
  const id = `net-${ip.replace(/\./g, "-")}`;
  const device = stmts.getDevice.get(id) as any;
  if (device) { const existingPorts: number[] = JSON.parse(device.ports || "[]"); const merged = [...new Set([...existingPorts, ...openPorts])].sort((a, b) => a - b); stmts.updatePorts.run(JSON.stringify(merged), id); }
  return c.json({ ip, ports: openPorts }, 200);
});

const updateDeviceRoute = createRoute({ method: 'put', path: '/devices/{id}', tags: ['Network'], request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ label: z.string().optional(), hostname: z.string().optional() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Updated' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
networkRoutes.openapi(updateDeviceRoute, async (c) => {
  const id = c.req.valid('param').id; const device = stmts.getDevice.get(id) as any;
  if (!device) return c.json({ error: "Device not found" } as any, 404);
  const { label, hostname } = c.req.valid('json');
  stmts.updateDevice.run(label ?? device.label, hostname ?? device.hostname, id);
  return c.json({ ok: true }, 200);
});

const deleteDeviceRoute = createRoute({ method: 'delete', path: '/devices/{id}', tags: ['Network'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' } } });
networkRoutes.openapi(deleteDeviceRoute, (c) => { stmts.deleteDevice.run(c.req.valid('param').id); return c.json({ ok: true }, 200); });

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Network'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
networkRoutes.openapi(healthRoute, (c) => c.json({ module: "network", status: "ok" }, 200));
