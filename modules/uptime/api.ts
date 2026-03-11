import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const uptimeRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS uptime_services (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, check_interval INTEGER NOT NULL DEFAULT 60, expected_status INTEGER NOT NULL DEFAULT 200, created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
db.run(`CREATE TABLE IF NOT EXISTS uptime_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, service_id TEXT NOT NULL, status INTEGER NOT NULL, response_ms INTEGER NOT NULL, error TEXT, checked_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (service_id) REFERENCES uptime_services(id) ON DELETE CASCADE)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service_id, checked_at)`);

const stmts = {
  listServices: db.prepare("SELECT * FROM uptime_services ORDER BY name"),
  getService: db.prepare("SELECT * FROM uptime_services WHERE id = ?"),
  insertService: db.prepare("INSERT INTO uptime_services (id, name, url, check_interval, expected_status) VALUES (?, ?, ?, ?, ?)"),
  updateService: db.prepare("UPDATE uptime_services SET name = ?, url = ?, check_interval = ?, expected_status = ? WHERE id = ?"),
  deleteService: db.prepare("DELETE FROM uptime_services WHERE id = ?"),
  deleteChecks: db.prepare("DELETE FROM uptime_checks WHERE service_id = ?"),
  insertCheck: db.prepare("INSERT INTO uptime_checks (service_id, status, response_ms, error) VALUES (?, ?, ?, ?)"),
  latestCheck: db.prepare("SELECT * FROM uptime_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 1"),
  history: db.prepare("SELECT * FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours') ORDER BY checked_at DESC"),
  recentChecks: db.prepare("SELECT status, response_ms FROM uptime_checks WHERE service_id = ? ORDER BY checked_at DESC LIMIT 20"),
  statsTotal: db.prepare("SELECT COUNT(*) as total FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours')"),
  statsUp: db.prepare("SELECT COUNT(*) as up FROM uptime_checks WHERE service_id = ? AND status = ? AND checked_at >= datetime('now', ? || ' hours')"),
  statsAvg: db.prepare("SELECT AVG(response_ms) as avg_ms FROM uptime_checks WHERE service_id = ? AND checked_at >= datetime('now', ? || ' hours')"),
};

async function checkService(service: { id: string; url: string; expected_status: number }) {
  const start = Date.now(); let status = 0; let error: string | null = null;
  try { const res = await fetch(service.url, { signal: AbortSignal.timeout(10000) }); status = res.status; }
  catch (e: any) { status = 0; error = e?.message || "Unknown error"; }
  const responseMs = Date.now() - start;
  stmts.insertCheck.run(service.id, status, responseMs, error);
  return { status, responseMs, error };
}

async function checkAllServices() {
  const services = stmts.listServices.all() as any[];
  const results = [];
  for (const svc of services) { const result = await checkService(svc); results.push({ id: svc.id, name: svc.name, ...result }); }
  return results;
}

setInterval(checkAllServices, 60000);

const listRoute = createRoute({ method: 'get', path: '/services', tags: ['Uptime'], description: 'List services with latest check', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Service list' } } });
uptimeRoutes.openapi(listRoute, (c) => {
  const services = stmts.listServices.all() as any[];
  const enriched = services.map((svc) => ({ ...svc, latest_check: stmts.latestCheck.get(svc.id) || null, recent_response_ms: (stmts.recentChecks.all(svc.id) as any[]).map((r: any) => r.response_ms).reverse() }));
  return c.json({ services: enriched }, 200);
});

const createRoute2 = createRoute({ method: 'post', path: '/services', tags: ['Uptime'], request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), url: z.string(), check_interval: z.number().optional(), expected_status: z.number().optional() }) } } } }, responses: { 201: { content: { 'application/json': { schema: z.object({ id: z.string() }) } }, description: 'Created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
uptimeRoutes.openapi(createRoute2, async (c) => {
  const body = c.req.valid('json');
  if (!body.name || !body.url) return c.json({ error: "name and url are required" } as any, 400);
  const id = crypto.randomUUID();
  stmts.insertService.run(id, body.name, body.url, body.check_interval ?? 60, body.expected_status ?? 200);
  return c.json({ id }, 201);
});

const updateRoute = createRoute({ method: 'put', path: '/services/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), url: z.string().optional(), check_interval: z.number().optional(), expected_status: z.number().optional() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Updated' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(updateRoute, async (c) => {
  const id = c.req.valid('param').id; const existing = stmts.getService.get(id) as any;
  if (!existing) return c.json({ error: "Service not found" } as any, 404);
  const body = c.req.valid('json');
  stmts.updateService.run(body.name ?? existing.name, body.url ?? existing.url, body.check_interval ?? existing.check_interval, body.expected_status ?? existing.expected_status, id);
  return c.json({ ok: true }, 200);
});

const deleteRoute = createRoute({ method: 'delete', path: '/services/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' } } });
uptimeRoutes.openapi(deleteRoute, (c) => { const id = c.req.valid('param').id; stmts.deleteChecks.run(id); stmts.deleteService.run(id); return c.json({ ok: true }, 200); });

const historyRoute = createRoute({ method: 'get', path: '/history/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check history' } } });
uptimeRoutes.openapi(historyRoute, (c) => { const id = c.req.valid('param').id; const hours = c.req.query("hours") || "24"; return c.json({ checks: stmts.history.all(id, `-${hours}`) }, 200); });

const statsRoute = createRoute({ method: 'get', path: '/stats/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Uptime stats' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(statsRoute, (c) => {
  const id = c.req.valid('param').id; const service = stmts.getService.get(id) as any;
  if (!service) return c.json({ error: "Service not found" } as any, 404);
  const hoursStr = "-24";
  const total = (stmts.statsTotal.get(id, hoursStr) as any)?.total || 0;
  const up = (stmts.statsUp.get(id, service.expected_status, hoursStr) as any)?.up || 0;
  const avgMs = (stmts.statsAvg.get(id, hoursStr) as any)?.avg_ms || 0;
  return c.json({ uptime_pct: total > 0 ? ((up / total) * 100).toFixed(2) : "0.00", avg_response_ms: Math.round(avgMs), total_checks: total, checks_up: up }, 200);
});

const checkAllRoute = createRoute({ method: 'post', path: '/check', tags: ['Uptime'], description: 'Trigger check for all services', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check results' } } });
uptimeRoutes.openapi(checkAllRoute, async (c) => { const results = await checkAllServices(); return c.json({ results }, 200); });

const checkOneRoute = createRoute({ method: 'post', path: '/check/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check result' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(checkOneRoute, async (c) => {
  const id = c.req.valid('param').id; const service = stmts.getService.get(id) as any;
  if (!service) return c.json({ error: "Service not found" } as any, 404);
  return c.json(await checkService(service), 200);
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Uptime'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Module health' } } });
uptimeRoutes.openapi(healthRoute, (c) => { const count = (stmts.listServices.all() as any[]).length; return c.json({ status: "ok", module: "uptime", services: count }, 200); });
