import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const homelabRoutes = new Hono();

// ── SSRF prevention — block cloud metadata and localhost, allow homelab network ──
function isHomelabUrlSafe(urlString: string): { safe: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { safe: false, error: "Only http and https URLs are allowed" };
    }
    const hostname = url.hostname.toLowerCase();
    // Block localhost variants
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
      return { safe: false, error: "Localhost addresses are not allowed" };
    }
    // Block cloud metadata endpoint (169.254.169.254)
    if (/^169\.254\./.test(hostname)) {
      return { safe: false, error: "Link-local/metadata addresses are not allowed" };
    }
    // Block IPv6 loopback and link-local
    if (/^::1$/.test(hostname) || /^fe80:/i.test(hostname)) {
      return { safe: false, error: "Internal IPv6 addresses are not allowed" };
    }
    // Note: Private IPs (10.x, 172.16.x, 192.168.x) are intentionally ALLOWED
    // because homelab services legitimately monitor internal hosts on the LAN.
    return { safe: true };
  } catch {
    return { safe: false, error: "Invalid URL format" };
  }
}

interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  icon?: string;
  expected_status: number;
}

interface ServiceStatus {
  id: string;
  name: string;
  url: string;
  icon?: string;
  status: "up" | "down" | "unknown";
  responseTime: number | null;
  lastChecked: string;
  statusCode: number | null;
}

const stmts = {
  getAll: db.query("SELECT * FROM services ORDER BY created_at ASC"),
  insert: db.query("INSERT INTO services (id, name, url, icon, expected_status) VALUES (?, ?, ?, ?, ?)"),
  update: db.query("UPDATE services SET name = ?, url = ?, expected_status = ? WHERE id = ?"),
  getById: db.query("SELECT * FROM services WHERE id = ?"),
  delete: db.query("DELETE FROM services WHERE id = ?"),
  recordUptime: db.query("INSERT INTO uptime_history (service_id, status, response_time) VALUES (?, ?, ?)"),
  getHistory: db.query("SELECT status, response_time, checked_at FROM uptime_history WHERE service_id = ? ORDER BY checked_at DESC LIMIT ?"),
  getUptimePercent: db.query(`
    SELECT service_id,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as up_count
    FROM uptime_history
    WHERE checked_at > datetime('now', '-30 days')
    GROUP BY service_id
  `),
  cleanOldHistory: db.query("DELETE FROM uptime_history WHERE checked_at < datetime('now', '-30 days')"),
};

async function checkService(service: ServiceConfig): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(service.url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    // Any response under 500 = service is up (including redirects, 404s)
    // Only 5xx errors mean the service itself is broken
    const isUp = service.expected_status === 0
      ? res.status < 500
      : res.status === service.expected_status;
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: isUp ? "up" : "down",
      responseTime,
      lastChecked: new Date().toISOString(),
      statusCode: res.status,
    };
  } catch {
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: "down",
      responseTime: null,
      lastChecked: new Date().toISOString(),
      statusCode: null,
    };
  }
}

homelabRoutes.get("/health", (c) => c.json({ module: "homelab", status: "ok" }));

homelabRoutes.get("/services", async (c) => {
  const services = stmts.getAll.all() as ServiceConfig[];
  const statuses = await Promise.all(services.map(checkService));

  // Record uptime for each service
  for (const s of statuses) {
    stmts.recordUptime.run(s.id, s.status, s.responseTime);
  }

  // Get uptime percentages
  const uptimeRows = stmts.getUptimePercent.all() as any[];
  const uptimeMap: Record<string, number> = {};
  for (const row of uptimeRows) {
    uptimeMap[row.service_id] = row.total > 0 ? Math.round((row.up_count / row.total) * 1000) / 10 : 0;
  }

  return c.json({
    services: statuses.map((s) => ({ ...s, uptimePercent: uptimeMap[s.id] ?? 100 })),
    summary: {
      total: statuses.length,
      up: statuses.filter((s) => s.status === "up").length,
      down: statuses.filter((s) => s.status === "down").length,
    },
  });
});

homelabRoutes.get("/services/:id/history", (c) => {
  const id = c.req.param("id");
  const limit = Math.min(Number(c.req.query("limit")) || 100, 10000);
  const history = stmts.getHistory.all(id, limit);
  return c.json({ history });
});

homelabRoutes.post("/services", async (c) => {
  const body = await c.req.json<{ name: string; url: string; icon?: string; expectedStatus?: number }>();
  if (!body.name || !body.url) return c.json({ error: "name and url are required" }, 400);
  const urlCheck = isHomelabUrlSafe(body.url);
  if (!urlCheck.safe) return c.json({ error: urlCheck.error }, 400);
  const id = body.name.toLowerCase().replace(/\s+/g, "-");
  const expectedStatus = body.expectedStatus ?? 0;
  stmts.insert.run(id, body.name, body.url, body.icon || null, expectedStatus);
  return c.json({ id, name: body.name, url: body.url }, 201);
});

homelabRoutes.put("/services/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getById.get(id) as any;
  if (!existing) return c.json({ error: "Service not found" }, 404);
  const body = await c.req.json<{ name?: string; url?: string; expectedStatus?: number }>();
  if (body.url) {
    const urlCheck = isHomelabUrlSafe(body.url);
    if (!urlCheck.safe) return c.json({ error: urlCheck.error }, 400);
  }
  const name = body.name ?? existing.name;
  const url = body.url ?? existing.url;
  const expectedStatus = body.expectedStatus ?? existing.expected_status;
  stmts.update.run(name, url, expectedStatus, id);
  return c.json({ id, name, url, expectedStatus });
});

homelabRoutes.delete("/services/:id", (c) => {
  const id = c.req.param("id");
  stmts.delete.run(id);
  return c.json({ deleted: id });
});

// Docker host management
const dockerStmts = {
  getAllHosts: db.query("SELECT * FROM docker_hosts ORDER BY created_at ASC"),
  insertHost: db.query("INSERT INTO docker_hosts (id, name, url) VALUES (?, ?, ?)"),
  updateHost: db.query("UPDATE docker_hosts SET name = ?, url = ? WHERE id = ?"),
  deleteHost: db.query("DELETE FROM docker_hosts WHERE id = ?"),
  getHost: db.query("SELECT * FROM docker_hosts WHERE id = ?"),
};

homelabRoutes.get("/docker-hosts", (c) => {
  const hosts = dockerStmts.getAllHosts.all();
  return c.json({ hosts });
});

homelabRoutes.post("/docker-hosts", async (c) => {
  const body = await c.req.json<{ name: string; url: string }>();
  if (!body.name || !body.url) return c.json({ error: "name and url are required" }, 400);
  try { new URL(body.url); } catch { return c.json({ error: "Invalid Docker host URL" }, 400); }
  const urlCheck = isHomelabUrlSafe(body.url);
  if (!urlCheck.safe) return c.json({ error: urlCheck.error }, 400);
  const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  dockerStmts.insertHost.run(id, body.name, body.url);
  return c.json({ id, name: body.name, url: body.url }, 201);
});

homelabRoutes.put("/docker-hosts/:id", async (c) => {
  const id = c.req.param("id");
  const existing = dockerStmts.getHost.get(id);
  if (!existing) return c.json({ error: "Docker host not found" }, 404);
  const body = await c.req.json<{ name?: string; url?: string }>();
  if (body.url) {
    try { new URL(body.url); } catch { return c.json({ error: "Invalid Docker host URL" }, 400); }
    const urlCheck = isHomelabUrlSafe(body.url);
    if (!urlCheck.safe) return c.json({ error: urlCheck.error }, 400);
  }
  dockerStmts.updateHost.run(body.name || (existing as any).name, body.url || (existing as any).url, id);
  return c.json({ ok: true });
});

homelabRoutes.delete("/docker-hosts/:id", (c) => {
  const id = c.req.param("id");
  dockerStmts.deleteHost.run(id);
  return c.json({ deleted: id });
});

// Docker container actions — now supports host query param (validated against configured hosts)
homelabRoutes.post("/containers/:id/:action", async (c) => {
  const id = c.req.param("id");
  const action = c.req.param("action");
  const hostUrl = c.req.query("host");

  // Validate container ID — hex chars only
  if (!/^[a-f0-9]{12,64}$/.test(id)) {
    return c.json({ error: "Invalid container ID" }, 400);
  }

  if (!["start", "stop", "restart"].includes(action)) {
    return c.json({ error: "Invalid action. Use start, stop, or restart" }, 400);
  }

  // Validate host against configured Docker hosts to prevent SSRF
  let dockerHost = process.env.DOCKER_HOST || "http://localhost:2375";
  if (hostUrl) {
    const configuredHosts = (dockerStmts.getAllHosts.all() as { url: string }[]).map(h => h.url);
    if (process.env.DOCKER_HOST) configuredHosts.push(process.env.DOCKER_HOST);
    if (!configuredHosts.includes(hostUrl)) {
      return c.json({ error: "Unknown Docker host" }, 400);
    }
    dockerHost = hostUrl;
  }

  try {
    const res = await fetch(`${dockerHost}/containers/${id}/${action}`, { method: "POST" });
    if (!res.ok && res.status !== 304) {
      const text = await res.text();
      return c.json({ error: text }, res.status as 400 | 500);
    }
    return c.json({ ok: true, action, containerId: id });
  } catch {
    return c.json({ error: "Docker API not available" }, 503);
  }
});

// Fetch containers from all configured Docker hosts
homelabRoutes.get("/containers", async (c) => {
  const hosts = dockerStmts.getAllHosts.all() as { id: string; name: string; url: string }[];
  const defaultHost = process.env.DOCKER_HOST;

  // Build list of hosts to query
  const targets: { name: string; url: string }[] = [];
  if (defaultHost) targets.push({ name: "Local", url: defaultHost });
  for (const h of hosts) targets.push({ name: h.name, url: h.url });

  if (targets.length === 0) {
    return c.json({
      containers: [],
      hosts: [],
      error: "No Docker hosts configured. Add a Docker host or set DOCKER_HOST env var.",
    });
  }

  const allContainers: any[] = [];
  const hostStatuses: { name: string; url: string; status: "ok" | "error"; containerCount: number; error?: string }[] = [];

  await Promise.all(
    targets.map(async (target) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${target.url}/containers/json?all=true`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`${res.status}`);
        const containers = await res.json();
        const mapped = containers.map((ct: any) => ({
          id: ct.Id?.slice(0, 12),
          name: ct.Names?.[0]?.replace(/^\//, ""),
          image: ct.Image,
          state: ct.State,
          status: ct.Status,
          ports: ct.Ports?.map((p: any) => `${p.PublicPort || ""}:${p.PrivatePort}/${p.Type}`).filter(Boolean),
          created: ct.Created,
          host: target.name,
          hostUrl: target.url,
        }));
        allContainers.push(...mapped);
        hostStatuses.push({ name: target.name, url: target.url, status: "ok", containerCount: mapped.length });
      } catch (e: any) {
        hostStatuses.push({ name: target.name, url: target.url, status: "error", containerCount: 0, error: e.message });
      }
    })
  );

  return c.json({ containers: allContainers, hosts: hostStatuses });
});
