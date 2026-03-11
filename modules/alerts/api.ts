import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const alertsRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS alert_rules (id TEXT PRIMARY KEY, name TEXT NOT NULL, metric_type TEXT NOT NULL, operator TEXT NOT NULL DEFAULT 'gt', threshold REAL NOT NULL, target TEXT NOT NULL DEFAULT '', cooldown_minutes INTEGER NOT NULL DEFAULT 15, enabled INTEGER NOT NULL DEFAULT 1, webhook_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
db.run(`CREATE TABLE IF NOT EXISTS alert_history (id INTEGER PRIMARY KEY AUTOINCREMENT, rule_id TEXT NOT NULL, rule_name TEXT NOT NULL, metric_type TEXT NOT NULL, value REAL NOT NULL, threshold REAL NOT NULL, message TEXT NOT NULL, fired_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id, fired_at)`);

const stmts = {
  listRules: db.prepare("SELECT * FROM alert_rules ORDER BY name"),
  getRule: db.prepare("SELECT * FROM alert_rules WHERE id = ?"),
  insertRule: db.prepare("INSERT INTO alert_rules (id, name, metric_type, operator, threshold, target, cooldown_minutes, enabled, webhook_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  updateRule: db.prepare("UPDATE alert_rules SET name = ?, metric_type = ?, operator = ?, threshold = ?, target = ?, cooldown_minutes = ?, enabled = ?, webhook_url = ?, updated_at = datetime('now') WHERE id = ?"),
  deleteRule: db.prepare("DELETE FROM alert_rules WHERE id = ?"),
  listHistory: db.prepare("SELECT * FROM alert_history ORDER BY fired_at DESC LIMIT ?"),
  listHistoryForRule: db.prepare("SELECT * FROM alert_history WHERE rule_id = ? ORDER BY fired_at DESC LIMIT ?"),
  insertHistory: db.prepare("INSERT INTO alert_history (rule_id, rule_name, metric_type, value, threshold, message) VALUES (?, ?, ?, ?, ?, ?)"),
  clearHistory: db.prepare("DELETE FROM alert_history WHERE rule_id = ?"),
};

const VALID_METRICS = ["cpu", "memory", "disk", "service_down", "pod_restarts"];
const VALID_OPERATORS = ["gt", "lt", "gte", "lte", "eq"];

async function sendAlertNotification(ruleName: string, message: string) {
  const notifyUrl = process.env.NOTIFY_URL; const notifySlug = process.env.NOTIFY_ALERT_SLUG; const notifyKey = process.env.NOTIFY_ALERT_API_KEY;
  if (!notifyUrl || !notifySlug || !notifyKey) return;
  try { await fetch(`${notifyUrl}/api/webhook/${notifySlug}`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": notifyKey }, body: JSON.stringify({ title: `🚨 Alert: ${ruleName}`, body: message, priority: "high", data: { source: "cockpit-alerts" } }), signal: AbortSignal.timeout(5000) }); } catch { /* Best-effort */ }
}

const listRulesRoute = createRoute({ method: 'get', path: '/rules', tags: ['Alerts'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Alert rules' } } });
alertsRoutes.openapi(listRulesRoute, (c) => c.json({ rules: stmts.listRules.all() }, 200));

const getRuleRoute = createRoute({ method: 'get', path: '/rules/{id}', tags: ['Alerts'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Rule detail' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
alertsRoutes.openapi(getRuleRoute, (c) => { const rule = stmts.getRule.get(c.req.valid('param').id); if (!rule) return c.json({ error: "Rule not found" } as any, 404); return c.json(rule, 200); });

const createRuleRoute = createRoute({
  method: 'post', path: '/rules', tags: ['Alerts'],
  request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), metric_type: z.string(), operator: z.string().optional(), threshold: z.number(), target: z.string().optional(), cooldown_minutes: z.number().optional(), enabled: z.boolean().optional(), webhook_url: z.string().optional() }) } } } },
  responses: { 201: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), id: z.string() }) } }, description: 'Rule created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
alertsRoutes.openapi(createRuleRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.name || !body.metric_type || body.threshold === undefined) return c.json({ error: "name, metric_type, and threshold are required" } as any, 400);
  if (!VALID_METRICS.includes(body.metric_type)) return c.json({ error: `metric_type must be one of: ${VALID_METRICS.join(", ")}` } as any, 400);
  if (body.operator && !VALID_OPERATORS.includes(body.operator)) return c.json({ error: `operator must be one of: ${VALID_OPERATORS.join(", ")}` } as any, 400);
  if (body.webhook_url) { try { new URL(body.webhook_url); } catch { return c.json({ error: "Invalid webhook URL" } as any, 400); } }
  const id = crypto.randomUUID();
  stmts.insertRule.run(id, body.name, body.metric_type, body.operator || "gt", Number(body.threshold), body.target || "", Number(body.cooldown_minutes) || 15, body.enabled !== false ? 1 : 0, body.webhook_url || "");
  return c.json({ ok: true, id }, 201);
});

const updateRuleRoute = createRoute({
  method: 'put', path: '/rules/{id}', tags: ['Alerts'],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), metric_type: z.string().optional(), operator: z.string().optional(), threshold: z.number().optional(), target: z.string().optional(), cooldown_minutes: z.number().optional(), enabled: z.boolean().optional(), webhook_url: z.string().optional() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Rule updated' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } }
});
alertsRoutes.openapi(updateRuleRoute, async (c) => {
  const id = c.req.valid('param').id;
  const existing = stmts.getRule.get(id);
  if (!existing) return c.json({ error: "Rule not found" } as any, 404);
  const body = c.req.valid('json');
  if (body.metric_type && !VALID_METRICS.includes(body.metric_type)) return c.json({ error: `metric_type must be one of: ${VALID_METRICS.join(", ")}` } as any, 400);
  if (body.webhook_url) { try { new URL(body.webhook_url); } catch { return c.json({ error: "Invalid webhook URL" } as any, 400); } }
  const e = existing as any;
  stmts.updateRule.run(body.name || e.name, body.metric_type || e.metric_type, body.operator || e.operator, body.threshold !== undefined ? Number(body.threshold) : e.threshold, body.target !== undefined ? body.target : e.target, body.cooldown_minutes !== undefined ? Number(body.cooldown_minutes) : e.cooldown_minutes, body.enabled !== undefined ? (body.enabled ? 1 : 0) : e.enabled, body.webhook_url !== undefined ? body.webhook_url : e.webhook_url, id);
  return c.json({ ok: true }, 200);
});

const deleteRuleRoute = createRoute({ method: 'delete', path: '/rules/{id}', tags: ['Alerts'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Rule deleted' } } });
alertsRoutes.openapi(deleteRuleRoute, (c) => { const id = c.req.valid('param').id; stmts.clearHistory.run(id); stmts.deleteRule.run(id); return c.json({ ok: true }, 200); });

const historyRoute = createRoute({ method: 'get', path: '/history', tags: ['Alerts'], description: 'Alert history', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Alert history' } } });
alertsRoutes.openapi(historyRoute, (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 500);
  const ruleId = c.req.query("rule_id");
  const history = ruleId ? stmts.listHistoryForRule.all(ruleId, limit) : stmts.listHistory.all(limit);
  return c.json({ history }, 200);
});

const testRoute = createRoute({ method: 'post', path: '/test/{id}', tags: ['Alerts'], description: 'Fire a test alert', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), message: z.string() }) } }, description: 'Test alert fired' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
alertsRoutes.openapi(testRoute, (c) => {
  const rule = stmts.getRule.get(c.req.valid('param').id) as any;
  if (!rule) return c.json({ error: "Rule not found" } as any, 404);
  const msg = `[TEST] ${rule.name} threshold exceeded (test fire)`;
  stmts.insertHistory.run(rule.id, rule.name, rule.metric_type, rule.threshold + 1, rule.threshold, msg);
  sendAlertNotification(rule.name, msg);
  return c.json({ ok: true, message: "Test alert fired" }, 200);
});
