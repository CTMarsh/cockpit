import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const alertsRoutes = new Hono();

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT 'gt',
    threshold REAL NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    cooldown_minutes INTEGER NOT NULL DEFAULT 15,
    enabled INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS alert_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    message TEXT NOT NULL,
    fired_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id, fired_at)`);

const stmts = {
  listRules: db.prepare("SELECT * FROM alert_rules ORDER BY name"),
  getRule: db.prepare("SELECT * FROM alert_rules WHERE id = ?"),
  insertRule: db.prepare(
    "INSERT INTO alert_rules (id, name, metric_type, operator, threshold, target, cooldown_minutes, enabled, webhook_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ),
  updateRule: db.prepare(
    "UPDATE alert_rules SET name = ?, metric_type = ?, operator = ?, threshold = ?, target = ?, cooldown_minutes = ?, enabled = ?, webhook_url = ?, updated_at = datetime('now') WHERE id = ?"
  ),
  deleteRule: db.prepare("DELETE FROM alert_rules WHERE id = ?"),
  listHistory: db.prepare("SELECT * FROM alert_history ORDER BY fired_at DESC LIMIT ?"),
  listHistoryForRule: db.prepare("SELECT * FROM alert_history WHERE rule_id = ? ORDER BY fired_at DESC LIMIT ?"),
  insertHistory: db.prepare(
    "INSERT INTO alert_history (rule_id, rule_name, metric_type, value, threshold, message) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  clearHistory: db.prepare("DELETE FROM alert_history WHERE rule_id = ?"),
};

const VALID_METRICS = ["cpu", "memory", "disk", "service_down", "pod_restarts"];
const VALID_OPERATORS = ["gt", "lt", "gte", "lte", "eq"];

// Send alert notification via notify service (best-effort, never blocks)
async function sendAlertNotification(ruleName: string, message: string) {
  const notifyUrl = process.env.NOTIFY_URL;
  const notifySlug = process.env.NOTIFY_ALERT_SLUG;
  const notifyKey = process.env.NOTIFY_ALERT_API_KEY;
  if (!notifyUrl || !notifySlug || !notifyKey) return;

  try {
    await fetch(`${notifyUrl}/api/webhook/${notifySlug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": notifyKey },
      body: JSON.stringify({
        title: `🚨 Alert: ${ruleName}`,
        body: message,
        priority: "high",
        data: { source: "cockpit-alerts" },
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort — don't block alert processing
  }
}

// ── GET /rules — list all alert rules ──
alertsRoutes.get("/rules", (c) => {
  const rules = stmts.listRules.all();
  return c.json({ rules });
});

// ── GET /rules/:id — get single rule ──
alertsRoutes.get("/rules/:id", (c) => {
  const rule = stmts.getRule.get(c.req.param("id"));
  if (!rule) return c.json({ error: "Rule not found" }, 404);
  return c.json(rule);
});

// ── POST /rules — create rule ──
alertsRoutes.post("/rules", async (c) => {
  const body = await c.req.json();
  const { name, metric_type, operator, threshold, target, cooldown_minutes, enabled, webhook_url } = body;

  if (!name || !metric_type || threshold === undefined) {
    return c.json({ error: "name, metric_type, and threshold are required" }, 400);
  }
  if (!VALID_METRICS.includes(metric_type)) {
    return c.json({ error: `metric_type must be one of: ${VALID_METRICS.join(", ")}` }, 400);
  }
  if (operator && !VALID_OPERATORS.includes(operator)) {
    return c.json({ error: `operator must be one of: ${VALID_OPERATORS.join(", ")}` }, 400);
  }

  const id = crypto.randomUUID();
  stmts.insertRule.run(
    id, name, metric_type, operator || "gt", Number(threshold),
    target || "", Number(cooldown_minutes) || 15, enabled !== false ? 1 : 0, webhook_url || ""
  );
  return c.json({ ok: true, id }, 201);
});

// ── PUT /rules/:id — update rule ──
alertsRoutes.put("/rules/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getRule.get(id);
  if (!existing) return c.json({ error: "Rule not found" }, 404);

  const body = await c.req.json();
  const { name, metric_type, operator, threshold, target, cooldown_minutes, enabled, webhook_url } = body;

  if (metric_type && !VALID_METRICS.includes(metric_type)) {
    return c.json({ error: `metric_type must be one of: ${VALID_METRICS.join(", ")}` }, 400);
  }

  const e = existing as any;
  stmts.updateRule.run(
    name || e.name, metric_type || e.metric_type, operator || e.operator,
    threshold !== undefined ? Number(threshold) : e.threshold,
    target !== undefined ? target : e.target,
    cooldown_minutes !== undefined ? Number(cooldown_minutes) : e.cooldown_minutes,
    enabled !== undefined ? (enabled ? 1 : 0) : e.enabled,
    webhook_url !== undefined ? webhook_url : e.webhook_url,
    id
  );
  return c.json({ ok: true });
});

// ── DELETE /rules/:id — delete rule ──
alertsRoutes.delete("/rules/:id", (c) => {
  const id = c.req.param("id");
  stmts.clearHistory.run(id);
  stmts.deleteRule.run(id);
  return c.json({ ok: true });
});

// ── GET /history — alert history ──
alertsRoutes.get("/history", (c) => {
  const limit = Number(c.req.query("limit")) || 50;
  const ruleId = c.req.query("rule_id");
  const history = ruleId
    ? stmts.listHistoryForRule.all(ruleId, limit)
    : stmts.listHistory.all(limit);
  return c.json({ history });
});

// ── POST /test/:id — fire a test alert ──
alertsRoutes.post("/test/:id", (c) => {
  const rule = stmts.getRule.get(c.req.param("id")) as any;
  if (!rule) return c.json({ error: "Rule not found" }, 404);

  const msg = `[TEST] ${rule.name} threshold exceeded (test fire)`;
  stmts.insertHistory.run(
    rule.id, rule.name, rule.metric_type, rule.threshold + 1, rule.threshold, msg
  );

  // Send push notification (best-effort)
  sendAlertNotification(rule.name, msg);

  return c.json({ ok: true, message: "Test alert fired" });
});
