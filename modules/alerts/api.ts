import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const alertsRoutes = new OpenAPIHono();

const VALID_METRICS = ["cpu", "memory", "disk", "service_down", "pod_restarts"];
const VALID_OPERATORS = ["gt", "lt", "gte", "lte", "eq"];

async function sendAlertNotification(ruleName: string, message: string) {
  const notifyUrl = process.env.NOTIFY_URL; const notifySlug = process.env.NOTIFY_ALERT_SLUG; const notifyKey = process.env.NOTIFY_ALERT_API_KEY;
  if (!notifyUrl || !notifySlug || !notifyKey) return;
  try { await fetch(`${notifyUrl}/api/webhook/${notifySlug}`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": notifyKey }, body: JSON.stringify({ title: `🚨 Alert: ${ruleName}`, body: message, priority: "high", data: { source: "cockpit-alerts" } }), signal: AbortSignal.timeout(5000) }); } catch { /* Best-effort */ }
}

const listRulesRoute = createRoute({ method: 'get', path: '/rules', tags: ['Alerts'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Alert rules' } } });
alertsRoutes.openapi(listRulesRoute, async (c) => c.json({ rules: await sql`SELECT * FROM alert_rules ORDER BY name` }, 200));

const getRuleRoute = createRoute({ method: 'get', path: '/rules/{id}', tags: ['Alerts'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Rule detail' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
alertsRoutes.openapi(getRuleRoute, async (c) => { const [rule] = await sql`SELECT * FROM alert_rules WHERE id = ${c.req.valid('param').id}`; if (!rule) return c.json({ error: "Rule not found" } as any, 404); return c.json(rule, 200); });

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
  const enabled = body.enabled !== false ? 1 : 0;
  await sql`INSERT INTO alert_rules (id, name, metric_type, operator, threshold, target, cooldown_minutes, enabled, webhook_url) VALUES (${id}, ${body.name}, ${body.metric_type}, ${body.operator || "gt"}, ${Number(body.threshold)}, ${body.target || ""}, ${Number(body.cooldown_minutes) || 15}, ${enabled}, ${body.webhook_url || ""})`;
  return c.json({ ok: true, id }, 201);
});

const updateRuleRoute = createRoute({
  method: 'put', path: '/rules/{id}', tags: ['Alerts'],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), metric_type: z.string().optional(), operator: z.string().optional(), threshold: z.number().optional(), target: z.string().optional(), cooldown_minutes: z.number().optional(), enabled: z.boolean().optional(), webhook_url: z.string().optional() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Rule updated' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } }
});
alertsRoutes.openapi(updateRuleRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM alert_rules WHERE id = ${id}`;
  if (!existing) return c.json({ error: "Rule not found" } as any, 404);
  const body = c.req.valid('json');
  if (body.metric_type && !VALID_METRICS.includes(body.metric_type)) return c.json({ error: `metric_type must be one of: ${VALID_METRICS.join(", ")}` } as any, 400);
  if (body.webhook_url) { try { new URL(body.webhook_url); } catch { return c.json({ error: "Invalid webhook URL" } as any, 400); } }
  const e = existing as any;
  const name = body.name || e.name;
  const metric_type = body.metric_type || e.metric_type;
  const operator = body.operator || e.operator;
  const threshold = body.threshold !== undefined ? Number(body.threshold) : e.threshold;
  const target = body.target !== undefined ? body.target : e.target;
  const cooldown_minutes = body.cooldown_minutes !== undefined ? Number(body.cooldown_minutes) : e.cooldown_minutes;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : e.enabled;
  const webhook_url = body.webhook_url !== undefined ? body.webhook_url : e.webhook_url;
  await sql`UPDATE alert_rules SET name = ${name}, metric_type = ${metric_type}, operator = ${operator}, threshold = ${threshold}, target = ${target}, cooldown_minutes = ${cooldown_minutes}, enabled = ${enabled}, webhook_url = ${webhook_url}, updated_at = NOW() WHERE id = ${id}`;
  return c.json({ ok: true }, 200);
});

const deleteRuleRoute = createRoute({ method: 'delete', path: '/rules/{id}', tags: ['Alerts'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Rule deleted' } } });
alertsRoutes.openapi(deleteRuleRoute, async (c) => { const id = c.req.valid('param').id; await sql`DELETE FROM alert_history WHERE rule_id = ${id}`; await sql`DELETE FROM alert_rules WHERE id = ${id}`; return c.json({ ok: true }, 200); });

const historyRoute = createRoute({ method: 'get', path: '/history', tags: ['Alerts'], description: 'Alert history', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Alert history' } } });
alertsRoutes.openapi(historyRoute, async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 500);
  const ruleId = c.req.query("rule_id");
  const history = ruleId
    ? await sql`SELECT * FROM alert_history WHERE rule_id = ${ruleId} ORDER BY fired_at DESC LIMIT ${limit}`
    : await sql`SELECT * FROM alert_history ORDER BY fired_at DESC LIMIT ${limit}`;
  return c.json({ history }, 200);
});

const testRoute = createRoute({ method: 'post', path: '/test/{id}', tags: ['Alerts'], description: 'Fire a test alert', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean(), message: z.string() }) } }, description: 'Test alert fired' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
alertsRoutes.openapi(testRoute, async (c) => {
  const [rule] = await sql`SELECT * FROM alert_rules WHERE id = ${c.req.valid('param').id}`;
  if (!rule) return c.json({ error: "Rule not found" } as any, 404);
  const r = rule as any;
  const msg = `[TEST] ${r.name} threshold exceeded (test fire)`;
  await sql`INSERT INTO alert_history (rule_id, rule_name, metric_type, value, threshold, message) VALUES (${r.id}, ${r.name}, ${r.metric_type}, ${r.threshold + 1}, ${r.threshold}, ${msg})`;
  sendAlertNotification(r.name, msg);
  return c.json({ ok: true, message: "Test alert fired" }, 200);
});
