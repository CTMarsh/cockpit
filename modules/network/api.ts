import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const networkRoutes = new Hono();

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS network_devices (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    mac TEXT NOT NULL DEFAULT '',
    hostname TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    ports TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'unknown'
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip)`);

const stmts = {
  listDevices: db.prepare("SELECT * FROM network_devices ORDER BY ip"),
  getDeviceByIp: db.prepare("SELECT * FROM network_devices WHERE ip = ?"),
  getDevice: db.prepare("SELECT * FROM network_devices WHERE id = ?"),
  insertDevice: db.prepare(
    "INSERT INTO network_devices (id, ip, mac, hostname, label, ports, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ),
  upsertDevice: db.prepare(`
    INSERT INTO network_devices (id, ip, mac, hostname, label, ports, status, first_seen, last_seen)
    VALUES (?, ?, '', '', '', ?, 'online', datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      ports = excluded.ports,
      status = 'online',
      last_seen = datetime('now')
  `),
  updateDevice: db.prepare(
    "UPDATE network_devices SET label = ?, hostname = ? WHERE id = ?"
  ),
  updatePorts: db.prepare(
    "UPDATE network_devices SET ports = ?, last_seen = datetime('now') WHERE id = ?"
  ),
  deleteDevice: db.prepare("DELETE FROM network_devices WHERE id = ?"),
  markOffline: db.prepare("UPDATE network_devices SET status = 'offline' WHERE id = ?"),
};

// Common ports for network scan
const COMMON_PORTS = [22, 80, 443, 8006, 8080, 9000, 3000, 4000, 4100, 5050, 6443];

// Detailed port scan ports
const DETAILED_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995,
  3306, 3389, 5432, 5900, 6379, 8080, 8443, 8888, 9090,
];

// TCP port check using Bun.connect
async function checkPort(host: string, port: number, timeout = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    try {
      Bun.connect({
        hostname: host,
        port,
        socket: {
          open(socket) {
            clearTimeout(timer);
            socket.end();
            resolve(true);
          },
          error() {
            clearTimeout(timer);
            resolve(false);
          },
          close() {},
          data() {},
        },
      });
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

// Limit concurrency helper
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).then(() => {
      executing.delete(p);
    });
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// GET /devices — list all known devices
networkRoutes.get("/devices", (c) => {
  const devices = stmts.listDevices.all() as any[];
  const parsed = devices.map((d) => ({
    ...d,
    ports: JSON.parse(d.ports || "[]"),
  }));
  return c.json({ devices: parsed });
});

// POST /scan — scan 10.0.80.0/24 network
networkRoutes.post("/scan", async (c) => {
  const ips: string[] = [];
  for (let i = 1; i <= 255; i++) {
    ips.push(`10.0.80.${i}`);
  }

  // Mark all existing devices offline first — responsive ones get marked online during scan
  const existing = stmts.listDevices.all() as any[];
  for (const dev of existing) {
    stmts.markOffline.run(dev.id);
  }

  const found: Array<{ ip: string; ports: number[] }> = [];

  await withConcurrency(ips, 50, async (ip) => {
    // Quick probe: check ports 80 and 443 first
    const quickProbe = await Promise.all([
      checkPort(ip, 80, 2000),
      checkPort(ip, 443, 2000),
    ]);

    const isAlive = quickProbe.some(Boolean);
    if (!isAlive) return;

    // Host responded — scan all common ports
    const portResults = await Promise.all(
      COMMON_PORTS.map(async (port) => ({
        port,
        open: await checkPort(ip, port, 2000),
      }))
    );

    const openPorts = portResults.filter((r) => r.open).map((r) => r.port);

    // Generate stable ID from IP
    const id = `net-${ip.replace(/\./g, "-")}`;
    const portsJson = JSON.stringify(openPorts);

    stmts.upsertDevice.run(id, ip, portsJson);
    found.push({ ip, ports: openPorts });
  });

  // Re-fetch all devices to return current state
  const devices = stmts.listDevices.all() as any[];
  const parsed = devices.map((d) => ({
    ...d,
    ports: JSON.parse(d.ports || "[]"),
  }));

  return c.json({
    scanned: ips.length,
    found: found.length,
    devices: parsed,
  });
});

// POST /portscan/:ip — detailed port scan on a single IP
networkRoutes.post("/portscan/:ip", async (c) => {
  const ip = c.req.param("ip");

  // Validate IP format
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return c.json({ error: "Invalid IP address" }, 400);
  }

  const results = await Promise.all(
    DETAILED_PORTS.map(async (port) => ({
      port,
      open: await checkPort(ip, port, 2000),
    }))
  );

  const openPorts = results.filter((r) => r.open).map((r) => r.port);

  // Update device if it exists
  const id = `net-${ip.replace(/\./g, "-")}`;
  const device = stmts.getDevice.get(id) as any;
  if (device) {
    // Merge with existing ports (union of both sets)
    const existingPorts: number[] = JSON.parse(device.ports || "[]");
    const merged = [...new Set([...existingPorts, ...openPorts])].sort((a, b) => a - b);
    stmts.updatePorts.run(JSON.stringify(merged), id);
  }

  return c.json({ ip, ports: openPorts });
});

// PUT /devices/:id — update device label/hostname
networkRoutes.put("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const device = stmts.getDevice.get(id) as any;
  if (!device) return c.json({ error: "Device not found" }, 404);

  const { label, hostname } = await c.req.json<{
    label?: string;
    hostname?: string;
  }>();

  stmts.updateDevice.run(
    label ?? device.label,
    hostname ?? device.hostname,
    id
  );

  return c.json({ ok: true });
});

// DELETE /devices/:id — remove device
networkRoutes.delete("/devices/:id", (c) => {
  const id = c.req.param("id");
  stmts.deleteDevice.run(id);
  return c.json({ ok: true });
});

// GET /health
networkRoutes.get("/health", (c) => c.json({ module: "network", status: "ok" }));
