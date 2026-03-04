import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const deployHistoryRoutes = new Hono();

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS deployment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deployment TEXT NOT NULL,
    namespace TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT NOT NULL DEFAULT '',
    new_value TEXT NOT NULL DEFAULT '',
    triggered_by TEXT NOT NULL DEFAULT 'cockpit',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_deploy_events_deploy ON deployment_events(deployment, created_at)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_deploy_events_time ON deployment_events(created_at)`);

const stmts = {
  list: db.prepare(
    "SELECT * FROM deployment_events ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ),
  listByDeploy: db.prepare(
    "SELECT * FROM deployment_events WHERE deployment = ? AND namespace = ? ORDER BY created_at DESC LIMIT ?"
  ),
  listByNamespace: db.prepare(
    "SELECT * FROM deployment_events WHERE namespace = ? ORDER BY created_at DESC LIMIT ?"
  ),
  insert: db.prepare(
    "INSERT INTO deployment_events (deployment, namespace, action, old_value, new_value, triggered_by) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  count: db.prepare("SELECT COUNT(*) as count FROM deployment_events"),
};

// ── GET /events — list deployment events with filtering ──
deployHistoryRoutes.get("/events", (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;
  const deployment = c.req.query("deployment");
  const namespace = c.req.query("namespace");

  let events;
  if (deployment && namespace) {
    events = stmts.listByDeploy.all(deployment, namespace, limit);
  } else if (namespace) {
    events = stmts.listByNamespace.all(namespace, limit);
  } else {
    events = stmts.list.all(limit, offset);
  }

  const total = (stmts.count.get() as any)?.count || 0;
  return c.json({ events, total });
});

// ── POST /record — record a deployment event (called internally) ──
deployHistoryRoutes.post("/record", async (c) => {
  const body = await c.req.json();
  const { deployment, namespace, action, old_value, new_value, triggered_by } = body;

  if (!deployment || !namespace || !action) {
    return c.json({ error: "deployment, namespace, and action are required" }, 400);
  }

  stmts.insert.run(
    deployment, namespace, action,
    old_value || "", new_value || "", triggered_by || "cockpit"
  );
  return c.json({ ok: true }, 201);
});

/** Helper: record an event from other modules */
export function recordDeployEvent(
  deployment: string, namespace: string, action: string,
  oldValue = "", newValue = "", triggeredBy = "cockpit"
) {
  stmts.insert.run(deployment, namespace, action, oldValue, newValue, triggeredBy);
}
