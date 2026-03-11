import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const deployHistoryRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS deployment_events (id INTEGER PRIMARY KEY AUTOINCREMENT, deployment TEXT NOT NULL, namespace TEXT NOT NULL, action TEXT NOT NULL, old_value TEXT NOT NULL DEFAULT '', new_value TEXT NOT NULL DEFAULT '', triggered_by TEXT NOT NULL DEFAULT 'cockpit', created_at TEXT NOT NULL DEFAULT (datetime('now')))`);
db.run(`CREATE INDEX IF NOT EXISTS idx_deploy_events_deploy ON deployment_events(deployment, created_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_deploy_events_time ON deployment_events(created_at)`);

const stmts = {
  list: db.prepare("SELECT * FROM deployment_events ORDER BY created_at DESC LIMIT ? OFFSET ?"),
  listByDeploy: db.prepare("SELECT * FROM deployment_events WHERE deployment = ? AND namespace = ? ORDER BY created_at DESC LIMIT ?"),
  listByNamespace: db.prepare("SELECT * FROM deployment_events WHERE namespace = ? ORDER BY created_at DESC LIMIT ?"),
  insert: db.prepare("INSERT INTO deployment_events (deployment, namespace, action, old_value, new_value, triggered_by) VALUES (?, ?, ?, ?, ?, ?)"),
  count: db.prepare("SELECT COUNT(*) as count FROM deployment_events"),
};

const eventsRoute = createRoute({
  method: 'get', path: '/events', tags: ['Deploy History'],
  description: 'List deployment events with filtering',
  responses: { 200: { content: { 'application/json': { schema: z.object({ events: z.array(z.any()), total: z.number() }) } }, description: 'Deployment events' } }
});
deployHistoryRoutes.openapi(eventsRoute, (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;
  const deployment = c.req.query("deployment");
  const namespace = c.req.query("namespace");
  let events;
  if (deployment && namespace) events = stmts.listByDeploy.all(deployment, namespace, limit);
  else if (namespace) events = stmts.listByNamespace.all(namespace, limit);
  else events = stmts.list.all(limit, offset);
  const total = (stmts.count.get() as any)?.count || 0;
  return c.json({ events, total }, 200);
});

const recordRoute = createRoute({
  method: 'post', path: '/record', tags: ['Deploy History'],
  description: 'Record a deployment event',
  request: { body: { content: { 'application/json': { schema: z.object({ deployment: z.string(), namespace: z.string(), action: z.string(), old_value: z.string().optional(), new_value: z.string().optional(), triggered_by: z.string().optional() }) } } } },
  responses: { 201: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Event recorded' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
deployHistoryRoutes.openapi(recordRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.deployment || !body.namespace || !body.action) return c.json({ error: "deployment, namespace, and action are required" } as any, 400);
  stmts.insert.run(body.deployment, body.namespace, body.action, body.old_value || "", body.new_value || "", body.triggered_by || "cockpit");
  return c.json({ ok: true }, 201);
});

export function recordDeployEvent(deployment: string, namespace: string, action: string, oldValue = "", newValue = "", triggeredBy = "cockpit") {
  stmts.insert.run(deployment, namespace, action, oldValue, newValue, triggeredBy);
}
