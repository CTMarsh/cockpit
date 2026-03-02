import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const homelabRoutes = new Hono();

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
    const res = await fetch(service.url, { signal: controller.signal });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: res.status === service.expected_status ? "up" : "down",
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
  const limit = Number(c.req.query("limit")) || 100;
  const history = stmts.getHistory.all(id, limit);
  return c.json({ history });
});

homelabRoutes.post("/services", async (c) => {
  const body = await c.req.json<{ name: string; url: string; icon?: string; expectedStatus?: number }>();
  if (!body.name || !body.url) return c.json({ error: "name and url are required" }, 400);
  const id = body.name.toLowerCase().replace(/\s+/g, "-");
  const expectedStatus = body.expectedStatus || 200;
  stmts.insert.run(id, body.name, body.url, body.icon || null, expectedStatus);
  return c.json({ id, name: body.name, url: body.url }, 201);
});

homelabRoutes.delete("/services/:id", (c) => {
  const id = c.req.param("id");
  stmts.delete.run(id);
  return c.json({ deleted: id });
});

homelabRoutes.get("/containers", async (c) => {
  try {
    const dockerHost = process.env.DOCKER_HOST || "http://localhost:2375";
    const res = await fetch(`${dockerHost}/containers/json?all=true`);
    if (!res.ok) throw new Error(`Docker API returned ${res.status}`);
    const containers = await res.json();
    return c.json({
      containers: containers.map((ct: any) => ({
        id: ct.Id?.slice(0, 12),
        name: ct.Names?.[0]?.replace(/^\//, ""),
        image: ct.Image,
        state: ct.State,
        status: ct.Status,
        ports: ct.Ports?.map((p: any) => `${p.PublicPort || ""}:${p.PrivatePort}/${p.Type}`).filter(Boolean),
        created: ct.Created,
      })),
    });
  } catch {
    return c.json({
      containers: [],
      error: "Docker API not available. Set DOCKER_HOST env var or expose Docker TCP API.",
    });
  }
});
