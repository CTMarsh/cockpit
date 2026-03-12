import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const uptimeRoutes = new OpenAPIHono();

async function checkService(service: { id: string; url: string; expected_status: number }) {
  const start = Date.now(); let status = 0; let error: string | null = null;
  try { const res = await fetch(service.url, { signal: AbortSignal.timeout(10000) }); status = res.status; }
  catch (e: any) { status = 0; error = e?.message || "Unknown error"; }
  const responseMs = Date.now() - start;
  await sql`INSERT INTO uptime_checks (service_id, status, response_time_ms, error) VALUES (${service.id}, ${status}, ${responseMs}, ${error})`;
  return { status, responseMs, error };
}

async function checkAllServices() {
  const services = await sql`SELECT * FROM uptime_services ORDER BY name`;
  const results = [];
  for (const svc of services) { const result = await checkService(svc as any); results.push({ id: svc.id, name: svc.name, ...result }); }
  return results;
}

setInterval(() => { checkAllServices().catch(console.error); }, 60000);

const listRoute = createRoute({ method: 'get', path: '/services', tags: ['Uptime'], description: 'List services with latest check', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Service list' } } });
uptimeRoutes.openapi(listRoute, async (c) => {
  const services = await sql`SELECT * FROM uptime_services ORDER BY name`;
  const enriched = await Promise.all(services.map(async (svc: any) => {
    const [latestCheck] = await sql`SELECT * FROM uptime_checks WHERE service_id = ${svc.id} ORDER BY checked_at DESC LIMIT 1`;
    const recentChecks = await sql`SELECT status, response_time_ms FROM uptime_checks WHERE service_id = ${svc.id} ORDER BY checked_at DESC LIMIT 20`;
    return { ...svc, latest_check: latestCheck || null, recent_response_ms: recentChecks.map((r: any) => r.response_time_ms).reverse() };
  }));
  return c.json({ services: enriched }, 200);
});

const createRoute2 = createRoute({ method: 'post', path: '/services', tags: ['Uptime'], request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), url: z.string(), interval_seconds: z.number().optional(), expected_status: z.number().optional() }) } } } }, responses: { 201: { content: { 'application/json': { schema: z.object({ id: z.string() }) } }, description: 'Created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
uptimeRoutes.openapi(createRoute2, async (c) => {
  const body = c.req.valid('json');
  if (!body.name || !body.url) return c.json({ error: "name and url are required" } as any, 400);
  const id = crypto.randomUUID();
  await sql`INSERT INTO uptime_services (id, name, url, interval_seconds, expected_status) VALUES (${id}, ${body.name}, ${body.url}, ${body.interval_seconds ?? 60}, ${body.expected_status ?? 200})`;
  return c.json({ id }, 201);
});

const updateRoute = createRoute({ method: 'put', path: '/services/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), url: z.string().optional(), interval_seconds: z.number().optional(), expected_status: z.number().optional() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Updated' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(updateRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM uptime_services WHERE id = ${id}`;
  if (!existing) return c.json({ error: "Service not found" } as any, 404);
  const body = c.req.valid('json');
  await sql`UPDATE uptime_services SET name = ${body.name ?? existing.name}, url = ${body.url ?? existing.url}, interval_seconds = ${body.interval_seconds ?? existing.interval_seconds}, expected_status = ${body.expected_status ?? existing.expected_status} WHERE id = ${id}`;
  return c.json({ ok: true }, 200);
});

const deleteRoute = createRoute({ method: 'delete', path: '/services/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' } } });
uptimeRoutes.openapi(deleteRoute, async (c) => {
  const id = c.req.valid('param').id;
  await sql`DELETE FROM uptime_checks WHERE service_id = ${id}`;
  await sql`DELETE FROM uptime_services WHERE id = ${id}`;
  return c.json({ ok: true }, 200);
});

const historyRoute = createRoute({ method: 'get', path: '/history/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check history' } } });
uptimeRoutes.openapi(historyRoute, async (c) => {
  const id = c.req.valid('param').id;
  const hours = parseInt(c.req.query("hours") || "24");
  const checks = await sql`SELECT * FROM uptime_checks WHERE service_id = ${id} AND checked_at >= NOW() - make_interval(hours => ${hours}) ORDER BY checked_at DESC`;
  return c.json({ checks }, 200);
});

const statsRoute = createRoute({ method: 'get', path: '/stats/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Uptime stats' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(statsRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [service] = await sql`SELECT * FROM uptime_services WHERE id = ${id}`;
  if (!service) return c.json({ error: "Service not found" } as any, 404);
  const hours = 24;
  const [totalRow] = await sql`SELECT COUNT(*)::int as total FROM uptime_checks WHERE service_id = ${id} AND checked_at >= NOW() - make_interval(hours => ${hours})`;
  const [upRow] = await sql`SELECT COUNT(*)::int as up FROM uptime_checks WHERE service_id = ${id} AND status = ${service.expected_status} AND checked_at >= NOW() - make_interval(hours => ${hours})`;
  const [avgRow] = await sql`SELECT AVG(response_time_ms) as avg_ms FROM uptime_checks WHERE service_id = ${id} AND checked_at >= NOW() - make_interval(hours => ${hours})`;
  const total = totalRow?.total || 0;
  const up = upRow?.up || 0;
  const avgMs = avgRow?.avg_ms || 0;
  return c.json({ uptime_pct: total > 0 ? ((up / total) * 100).toFixed(2) : "0.00", avg_response_ms: Math.round(avgMs), total_checks: total, checks_up: up }, 200);
});

const checkAllRoute = createRoute({ method: 'post', path: '/check', tags: ['Uptime'], description: 'Trigger check for all services', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check results' } } });
uptimeRoutes.openapi(checkAllRoute, async (c) => { const results = await checkAllServices(); return c.json({ results }, 200); });

const checkOneRoute = createRoute({ method: 'post', path: '/check/{id}', tags: ['Uptime'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Check result' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
uptimeRoutes.openapi(checkOneRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [service] = await sql`SELECT * FROM uptime_services WHERE id = ${id}`;
  if (!service) return c.json({ error: "Service not found" } as any, 404);
  return c.json(await checkService(service as any), 200);
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Uptime'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Module health' } } });
uptimeRoutes.openapi(healthRoute, async (c) => {
  const [row] = await sql`SELECT COUNT(*)::int as count FROM uptime_services`;
  return c.json({ status: "ok", module: "uptime", services: row?.count || 0 }, 200);
});
