import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";
import { createSocket } from "node:dgram";

export const wolRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS wol_devices (id TEXT PRIMARY KEY, name TEXT NOT NULL, mac TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '', broadcast TEXT NOT NULL DEFAULT '255.255.255.255', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);

const stmts = {
  listDevices: db.prepare("SELECT * FROM wol_devices ORDER BY name"),
  getDevice: db.prepare("SELECT * FROM wol_devices WHERE id = ?"),
  insertDevice: db.prepare("INSERT INTO wol_devices (id, name, mac, ip, broadcast) VALUES (?, ?, ?, ?, ?)"),
  updateDevice: db.prepare("UPDATE wol_devices SET name = ?, mac = ?, ip = ?, broadcast = ? WHERE id = ?"),
  deleteDevice: db.prepare("DELETE FROM wol_devices WHERE id = ?"),
};

function buildMagicPacket(mac: string): Buffer {
  const macBytes = mac.replace(/[:-]/g, "").match(/.{2}/g);
  if (!macBytes || macBytes.length !== 6) throw new Error("Invalid MAC address");
  const macBuffer = Buffer.from(macBytes.map((b) => parseInt(b, 16)));
  const packet = Buffer.alloc(102);
  for (let i = 0; i < 6; i++) packet[i] = 0xff;
  for (let i = 0; i < 16; i++) macBuffer.copy(packet, 6 + i * 6);
  return packet;
}

async function sendWoL(mac: string, broadcast: string, port = 9): Promise<void> {
  const packet = buildMagicPacket(mac);
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    socket.once("error", (err) => { socket.close(); reject(err); });
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, port, broadcast, (err) => { socket.close(); if (err) reject(err); else resolve(); });
    });
  });
}

const IP_HOSTNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9.\-:]+$/;

async function pingHost(ip: string): Promise<boolean> {
  if (!ip || !IP_HOSTNAME_RE.test(ip) || ip.startsWith("-")) return false;
  try {
    const proc = Bun.spawn(["ping", "-c", "1", "-W", "1", ip], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch { return false; }
}

const listDevicesRoute = createRoute({
  method: 'get', path: '/devices', tags: ['Wake-on-LAN'],
  description: 'List all WoL devices with online status',
  responses: { 200: { content: { 'application/json': { schema: z.object({ devices: z.array(z.any()) }) } }, description: 'Device list' } }
});
wolRoutes.openapi(listDevicesRoute, async (c) => {
  const devices = stmts.listDevices.all() as any[];
  const withStatus = await Promise.all(devices.map(async (d) => ({ ...d, online: await pingHost(d.ip) })));
  return c.json({ devices: withStatus }, 200);
});

const createDeviceRoute = createRoute({
  method: 'post', path: '/devices', tags: ['Wake-on-LAN'],
  request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), mac: z.string(), ip: z.string().optional(), broadcast: z.string().optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string(), name: z.string(), mac: z.string() }) } }, description: 'Device created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
wolRoutes.openapi(createDeviceRoute, async (c) => {
  const { name, mac, ip, broadcast } = c.req.valid('json');
  if (!name || !mac) return c.json({ error: "name and mac are required" } as any, 400);
  const cleanMac = mac.replace(/[:-]/g, "");
  if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) return c.json({ error: "Invalid MAC address format" } as any, 400);
  const id = crypto.randomUUID();
  stmts.insertDevice.run(id, name, mac.toUpperCase(), ip || "", broadcast || "255.255.255.255");
  return c.json({ id, name, mac: mac.toUpperCase() }, 200);
});

const updateDeviceRoute = createRoute({
  method: 'put', path: '/devices/{id}', tags: ['Wake-on-LAN'],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), mac: z.string().optional(), ip: z.string().optional(), broadcast: z.string().optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Device updated' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
wolRoutes.openapi(updateDeviceRoute, async (c) => {
  const id = c.req.valid('param').id;
  const existing = stmts.getDevice.get(id) as any;
  if (!existing) return c.json({ error: "Device not found" } as any, 404);
  const { name, mac, ip, broadcast } = c.req.valid('json');
  if (mac !== undefined) { const cleanMac = mac.replace(/[:-]/g, ""); if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) return c.json({ error: "Invalid MAC address format" } as any, 400); }
  if (ip !== undefined && ip !== "" && !IP_HOSTNAME_RE.test(ip)) return c.json({ error: "Invalid IP address format" } as any, 400);
  stmts.updateDevice.run(name ?? existing.name, mac ? mac.toUpperCase() : existing.mac, ip ?? existing.ip, broadcast ?? existing.broadcast, id);
  return c.json({ ok: true }, 200);
});

const deleteDeviceRoute = createRoute({
  method: 'delete', path: '/devices/{id}', tags: ['Wake-on-LAN'],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Device deleted' } }
});
wolRoutes.openapi(deleteDeviceRoute, (c) => { stmts.deleteDevice.run(c.req.valid('param').id); return c.json({ ok: true }, 200); });

const wakeRoute = createRoute({
  method: 'post', path: '/wake/{id}', tags: ['Wake-on-LAN'],
  description: 'Send WoL magic packet to a device',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), name: z.string(), mac: z.string(), broadcast: z.string() }) } }, description: 'Packet sent' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' },
  }
});
wolRoutes.openapi(wakeRoute, async (c) => {
  const id = c.req.valid('param').id;
  const device = stmts.getDevice.get(id) as any;
  if (!device) return c.json({ error: "Device not found" } as any, 404);
  try { await sendWoL(device.mac, device.broadcast); return c.json({ ok: true, name: device.name, mac: device.mac, broadcast: device.broadcast }, 200); }
  catch (e: any) { return c.json({ error: e.message } as any, 500); }
});

const wakeMacRoute = createRoute({
  method: 'post', path: '/wake-mac', tags: ['Wake-on-LAN'],
  description: 'Send WoL to arbitrary MAC address',
  request: { body: { content: { 'application/json': { schema: z.object({ mac: z.string(), broadcast: z.string().optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), mac: z.string() }) } }, description: 'Packet sent' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    500: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' },
  }
});
wolRoutes.openapi(wakeMacRoute, async (c) => {
  const { mac, broadcast } = c.req.valid('json');
  if (!mac) return c.json({ error: "mac is required" } as any, 400);
  const cleanMac = mac.replace(/[:-]/g, "");
  if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) return c.json({ error: "Invalid MAC address format" } as any, 400);
  if (broadcast && (!IP_HOSTNAME_RE.test(broadcast) || broadcast.startsWith("-"))) return c.json({ error: "Invalid broadcast address" } as any, 400);
  try { await sendWoL(mac, broadcast || "255.255.255.255"); return c.json({ ok: true, mac }, 200); }
  catch (e: any) { return c.json({ error: e.message } as any, 500); }
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Wake-on-LAN'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
wolRoutes.openapi(healthRoute, (c) => c.json({ module: "wol", status: "ok" }, 200));
