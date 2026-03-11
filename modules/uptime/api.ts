import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const uptimeRoutes = new Hono();

// ── Create tables ──
db.run(`
  CREATE TABLE IF NOT EXISTS uptime_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    check_interval INTEGER NOT NULL DEFAULT 60,
    expected_status INTEGER NOT NULL DEFAULT 200,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS uptime_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL,
    status INTEGER NOT NULL,
    response_ms INTEGER NOT NULL,
    error TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_id) REFERENCES uptime_services(id) ON DELETE CASCADE
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service_id, checked_at)`);

// ── Prepared statements ──
const stmts = {
  listServices: db.prepare("SELECT * FROM uptime_services ORDER BY name"),
  getService: db.prepare("SELECT * FROM uptime_services WHERE id = ?"),
  insertService: db.prepare(
    "INSERT INTO uptime_services (id, name, url, check_interval, expected_status) VALUES (?, ?, ?, ?, ?)"
  ),
  updateService: db.prepare(
    "UPDATE uptime_services SET name = ?, url = ?, check_interval = ?, expected_status = ? WHERE id = ?"
  ),
  deleteService: db.prepare("DELETE FROM uptime_services WHERE id = ?"),
  deleteChecks: db.prepare("DELETE FROM uptime_checks WHERE service_id = ?"),
  insertCheck: db.prepare(
    "INSERT INTO uptime_checks (service_id, status, response_ms, error) VALUES (?, ?, ?, ?)"
  ),
  latestCheck: db.prepare(
    "SELECT * FROM uptime_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 1"
  ),
  history: db.prepare(
    "SELECT * FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours') ORDER BY checked_at DESC"
  ),
  recentChecks: db.prepare(
    "SELECT status, response_ms FROM uptime_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 20"
  ),
  statsTotal: db.prepare(
    "SELECT COUNT(*) as total FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours')"
  ),
  statsUp: db.prepare(
    "SELECT COUNT(*) as up FROM uptime_checks WHERE service_id = ? AND status = ? AND checked_at >= datetime('now', ? || ' hours')"
  ),
  statsAvg: db.prepare(
    "SELECT AVG(response_ms) as avg_ms FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours')"
  ),
};

// ── Check logic ──
async function checkService(service: { id: string; url: string; expected_status: number }) {
  const start = Date.now();
  let status = 0;
  let error: string | null = null;

  try {
    const res = await fetch(service.url, { signal: AbortSignal.timeout(10000) });
    status = res.status;
  } catch (e: any) {
    status = 0;
    error = e?.message || "Unknown error";
  }

  const responseMs = Date.now() - start;
  stmts.insertCheck.run(service.id, status, responseMs, error);
  return { status, responseMs, error };
}

async function checkAllServices() {
  const services = stmts.listServices.all() as any[];
  const results = [];
  for (const svc of services) {
    const result = await checkService(svc);
    results.push({ id: svc.id, name: svc.name, ...result });
  }
  return results;
}

// ── Background polling ──
setInterval(checkAllServices, 60000);

// ── GET /services — list all services with latest check ──
uptimeRoutes.get("/services", (c) => {
  const services = stmts.listServices.all() as any[];
  const enriched = services.map((svc) => {
    const latest = stmts.latestCheck.get(svc.id) as any;
    const recent = stmts.recentChecks.all(svc.id) as any[];
    return {
      ...svc,
      latest_check: latest || null,
      recent_response_ms: recent.map((r: any) => r.response_ms).reverse(),
    };
  });
  return c.json({ services: enriched });
});

// ── POST /services — create a service ──
uptimeRoutes.post("/services", async (c) => {
  const body = await c.req.json();
  const { name, url, check_interval, expected_status } = body;

  if (!name || !url) {
    return c.json({ error: "name and url are required" }, 400);
  }

  const id = crypto.randomUUID();
  stmts.insertService.run(id, name, url, check_interval ?? 60, expected_status ?? 200);
  return c.json({ id }, 201);
});

// ── PUT /services/:id — update a service ──
uptimeRoutes.put("/services/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getService.get(id) as any;
  if (!existing) return c.json({ error: "Service not found" }, 404);

  const body = await c.req.json();
  stmts.updateService.run(
    body.name ?? existing.name,
    body.url ?? existing.url,
    body.check_interval ?? existing.check_interval,
    body.expected_status ?? existing.expected_status,
    id
  );
  return c.json({ ok: true });
});

// ── DELETE /services/:id — delete service and its checks ──
uptimeRoutes.delete("/services/:id", (c) => {
  const id = c.req.param("id");
  stmts.deleteChecks.run(id);
  stmts.deleteService.run(id);
  return c.json({ ok: true });
});

// ── GET /history/:id — get check history for a service ──
uptimeRoutes.get("/history/:id", (c) => {
  const id = c.req.param("id");
  const hours = c.req.query("hours") || "24";
  const hoursStr = `-${hours}`;
  const checks = stmts.history.all(id, hoursStr) as any[];
  return c.json({ checks });
});

// ── GET /stats/:id — uptime stats ──
uptimeRoutes.get("/stats/:id", (c) => {
  const id = c.req.param("id");
  const service = stmts.getService.get(id) as any;
  if (!service) return c.json({ error: "Service not found" }, 404);

  const hoursStr = "-24";
  const total = (stmts.statsTotal.get(id, hoursStr) as any)?.total || 0;
  const up = (stmts.statsUp.get(id, service.expected_status, hoursStr) as any)?.up || 0;
  const avgMs = (stmts.statsAvg.get(id, hoursStr) as any)?.avg_ms || 0;

  return c.json({
    uptime_pct: total > 0 ? ((up / total) * 100).toFixed(2) : "0.00",
    avg_response_ms: Math.round(avgMs),
    total_checks: total,
    checks_up: up,
  });
});

// ── POST /check — manually trigger check for all services ──
uptimeRoutes.post("/check", async (c) => {
  const results = await checkAllServices();
  return c.json({ results });
});

// ── POST /check/:id — manually trigger check for one service ──
uptimeRoutes.post("/check/:id", async (c) => {
  const id = c.req.param("id");
  const service = stmts.getService.get(id) as any;
  if (!service) return c.json({ error: "Service not found" }, 404);

  const result = await checkService(service);
  return c.json(result);
});

// ── GET /health — module health ──
uptimeRoutes.get("/health", (c) => {
  const count = (stmts.listServices.all() as any[]).length;
  return c.json({ status: "ok", module: "uptime", services: count });
});
