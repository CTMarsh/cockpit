import { Hono } from "hono";
import { db } from "../../apps/api/src/db";
import { createSocket } from "node:dgram";

export const wolRoutes = new Hono();

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS wol_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mac TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    broadcast TEXT NOT NULL DEFAULT '255.255.255.255',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const stmts = {
  listDevices: db.prepare("SELECT * FROM wol_devices ORDER BY name"),
  getDevice: db.prepare("SELECT * FROM wol_devices WHERE id = ?"),
  insertDevice: db.prepare("INSERT INTO wol_devices (id, name, mac, ip, broadcast) VALUES (?, ?, ?, ?, ?)"),
  updateDevice: db.prepare("UPDATE wol_devices SET name = ?, mac = ?, ip = ?, broadcast = ? WHERE id = ?"),
  deleteDevice: db.prepare("DELETE FROM wol_devices WHERE id = ?"),
};

// Build magic packet: 6 bytes of 0xFF followed by 16 repetitions of the MAC
function buildMagicPacket(mac: string): Buffer {
  const macBytes = mac.replace(/[:-]/g, "").match(/.{2}/g);
  if (!macBytes || macBytes.length !== 6) throw new Error("Invalid MAC address");

  const macBuffer = Buffer.from(macBytes.map((b) => parseInt(b, 16)));
  const packet = Buffer.alloc(102);

  // 6 bytes of 0xFF
  for (let i = 0; i < 6; i++) packet[i] = 0xff;

  // 16 repetitions of the MAC address
  for (let i = 0; i < 16; i++) {
    macBuffer.copy(packet, 6 + i * 6);
  }

  return packet;
}

// Send magic packet via UDP broadcast
async function sendWoL(mac: string, broadcast: string, port = 9): Promise<void> {
  const packet = buildMagicPacket(mac);

  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    socket.once("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, port, broadcast, (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Validate IP address or hostname (prevent argument injection)
const IP_HOSTNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9.\-:]+$/;

// Check if a host is reachable
async function pingHost(ip: string): Promise<boolean> {
  if (!ip || !IP_HOSTNAME_RE.test(ip) || ip.startsWith("-")) return false;
  try {
    const proc = Bun.spawn(["ping", "-c", "1", "-W", "1", ip], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

// GET /api/wol/devices — list all devices with online status
wolRoutes.get("/devices", async (c) => {
  const devices = stmts.listDevices.all() as any[];

  // Check online status in parallel
  const withStatus = await Promise.all(
    devices.map(async (d) => ({
      ...d,
      online: await pingHost(d.ip),
    }))
  );

  return c.json({ devices: withStatus });
});

// POST /api/wol/devices — add a device
wolRoutes.post("/devices", async (c) => {
  const { name, mac, ip, broadcast } = await c.req.json<{
    name: string;
    mac: string;
    ip?: string;
    broadcast?: string;
  }>();

  if (!name || !mac) return c.json({ error: "name and mac are required" }, 400);

  // Validate MAC format
  const cleanMac = mac.replace(/[:-]/g, "");
  if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) {
    return c.json({ error: "Invalid MAC address format" }, 400);
  }

  const id = crypto.randomUUID();
  stmts.insertDevice.run(id, name, mac.toUpperCase(), ip || "", broadcast || "255.255.255.255");
  return c.json({ id, name, mac: mac.toUpperCase() });
});

// PUT /api/wol/devices/:id — update a device
wolRoutes.put("/devices/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getDevice.get(id) as any;
  if (!existing) return c.json({ error: "Device not found" }, 404);

  const { name, mac, ip, broadcast } = await c.req.json<{
    name?: string;
    mac?: string;
    ip?: string;
    broadcast?: string;
  }>();

  // Validate MAC if provided
  if (mac !== undefined) {
    const cleanMac = mac.replace(/[:-]/g, "");
    if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) {
      return c.json({ error: "Invalid MAC address format" }, 400);
    }
  }

  // Validate IP if provided
  if (ip !== undefined && ip !== "" && !IP_HOSTNAME_RE.test(ip)) {
    return c.json({ error: "Invalid IP address format" }, 400);
  }

  stmts.updateDevice.run(
    name ?? existing.name,
    mac ? mac.toUpperCase() : existing.mac,
    ip ?? existing.ip,
    broadcast ?? existing.broadcast,
    id
  );
  return c.json({ ok: true });
});

// DELETE /api/wol/devices/:id — delete a device
wolRoutes.delete("/devices/:id", (c) => {
  const id = c.req.param("id");
  stmts.deleteDevice.run(id);
  return c.json({ ok: true });
});

// POST /api/wol/wake/:id — send WoL magic packet
wolRoutes.post("/wake/:id", async (c) => {
  const id = c.req.param("id");
  const device = stmts.getDevice.get(id) as any;
  if (!device) return c.json({ error: "Device not found" }, 404);

  try {
    await sendWoL(device.mac, device.broadcast);
    return c.json({ ok: true, name: device.name, mac: device.mac, broadcast: device.broadcast });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// POST /api/wol/wake-mac — send WoL to arbitrary MAC (one-off)
wolRoutes.post("/wake-mac", async (c) => {
  const { mac, broadcast } = await c.req.json<{ mac: string; broadcast?: string }>();
  if (!mac) return c.json({ error: "mac is required" }, 400);

  try {
    await sendWoL(mac, broadcast || "255.255.255.255");
    return c.json({ ok: true, mac });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/wol/health
wolRoutes.get("/health", (c) => c.json({ module: "wol", status: "ok" }));
