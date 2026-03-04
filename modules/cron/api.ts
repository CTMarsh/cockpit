import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const cronRoutes = new Hono();

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    command TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS cron_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    exit_code INTEGER,
    output TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id, started_at)`);

// ── Command sanitization ──
const MAX_COMMAND_LENGTH = 1000;
// Allowlist: only alphanumeric, spaces, slashes, dots, hyphens, underscores, equals, colons, commas, @
const SAFE_COMMAND_PATTERN = /^[a-zA-Z0-9 /._=:,@+%\-\[\]]+$/;

function validateCommand(command: string): string | null {
  if (!command || command.length > MAX_COMMAND_LENGTH) {
    return "Command too long or empty";
  }
  if (!SAFE_COMMAND_PATTERN.test(command)) {
    return "Command contains disallowed characters. Only alphanumeric, spaces, slashes, dots, hyphens, underscores, equals, colons, and commas are allowed.";
  }
  return null;
}

// Split command into args safely (no shell interpretation)
function splitCommand(command: string): string[] {
  return command.trim().split(/\s+/).filter(Boolean);
}

const stmts = {
  listJobs: db.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC"),
  getJob: db.prepare("SELECT * FROM cron_jobs WHERE id = ?"),
  insertJob: db.prepare("INSERT INTO cron_jobs (id, name, schedule, command, enabled) VALUES (?, ?, ?, ?, ?)"),
  updateJob: db.prepare("UPDATE cron_jobs SET name = ?, schedule = ?, command = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?"),
  deleteJob: db.prepare("DELETE FROM cron_jobs WHERE id = ?"),
  insertRun: db.prepare("INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (?, ?, ?, datetime('now'))"),
  recentRuns: db.prepare("SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 20"),
  lastRun: db.prepare("SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 1"),
  allLastRuns: db.prepare(`
    SELECT cr.* FROM cron_runs cr
    INNER JOIN (SELECT job_id, MAX(started_at) as max_start FROM cron_runs GROUP BY job_id) latest
    ON cr.job_id = latest.job_id AND cr.started_at = latest.max_start
  `),
};

// Parse cron expression: minute hour day month weekday
function matchesCron(schedule: string, date: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const fields = [
    date.getMinutes(),   // minute
    date.getHours(),     // hour
    date.getDate(),      // day of month
    date.getMonth() + 1, // month (1-12)
    date.getDay(),       // day of week (0=Sun)
  ];

  return parts.every((part, i) => {
    if (part === "*") return true;

    // Handle */N step values
    if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2));
      return step > 0 && fields[i] % step === 0;
    }

    // Handle comma-separated values
    if (part.includes(",")) {
      return part.split(",").map(Number).includes(fields[i]);
    }

    // Handle ranges like 1-5
    if (part.includes("-")) {
      const [min, max] = part.split("-").map(Number);
      return fields[i] >= min && fields[i] <= max;
    }

    return parseInt(part) === fields[i];
  });
}

// Scheduler: check every 60 seconds
setInterval(async () => {
  const now = new Date();
  const jobs = stmts.listJobs.all() as any[];

  for (const job of jobs) {
    if (!job.enabled) continue;
    if (!matchesCron(job.schedule, now)) continue;

    try {
      const args = splitCommand(job.command);
      const proc = Bun.spawn(args, {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 300000, // 5 min timeout
      });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = proc.exitCode ?? -1;
      const output = (stdout + (stderr ? "\nSTDERR:\n" + stderr : "")).slice(0, 10000);
      stmts.insertRun.run(job.id, output, exitCode);
    } catch (e: any) {
      stmts.insertRun.run(job.id, `Error: ${e.message}`, -1);
    }
  }
}, 60000);

// GET /api/cron/jobs — list all jobs with last run info
cronRoutes.get("/jobs", (c) => {
  const jobs = stmts.listJobs.all() as any[];
  const lastRuns = stmts.allLastRuns.all() as any[];
  const runMap = new Map(lastRuns.map((r: any) => [r.job_id, r]));

  const result = jobs.map((j) => ({
    ...j,
    enabled: !!j.enabled,
    lastRun: runMap.get(j.id) || null,
  }));

  return c.json({ jobs: result });
});

// POST /api/cron/jobs — create a new job
cronRoutes.post("/jobs", async (c) => {
  const { name, schedule, command, enabled } = await c.req.json<{
    name: string;
    schedule: string;
    command: string;
    enabled?: boolean;
  }>();

  if (!name || !schedule || !command) {
    return c.json({ error: "name, schedule, and command are required" }, 400);
  }

  if (name.length > 200) {
    return c.json({ error: "Name must be 200 characters or fewer" }, 400);
  }

  // Validate cron expression format
  if (schedule.trim().split(/\s+/).length !== 5) {
    return c.json({ error: "Invalid cron expression. Use: minute hour day month weekday" }, 400);
  }

  // Validate command safety
  const cmdError = validateCommand(command);
  if (cmdError) {
    return c.json({ error: cmdError }, 400);
  }

  const id = crypto.randomUUID();
  stmts.insertJob.run(id, name, schedule.trim(), command, enabled !== false ? 1 : 0);
  return c.json({ id, name, schedule, command, enabled: enabled !== false });
});

// PUT /api/cron/jobs/:id — update a job
cronRoutes.put("/jobs/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getJob.get(id) as any;
  if (!existing) return c.json({ error: "Job not found" }, 404);

  const { name, schedule, command, enabled } = await c.req.json<{
    name?: string;
    schedule?: string;
    command?: string;
    enabled?: boolean;
  }>();

  if (name !== undefined && name.length > 200) {
    return c.json({ error: "Name must be 200 characters or fewer" }, 400);
  }

  if (command !== undefined) {
    const cmdError = validateCommand(command);
    if (cmdError) {
      return c.json({ error: cmdError }, 400);
    }
  }

  stmts.updateJob.run(
    name ?? existing.name,
    schedule ?? existing.schedule,
    command ?? existing.command,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  );

  return c.json({ ok: true });
});

// DELETE /api/cron/jobs/:id — delete a job
cronRoutes.delete("/jobs/:id", (c) => {
  const id = c.req.param("id");
  stmts.deleteJob.run(id);
  return c.json({ ok: true });
});

// GET /api/cron/jobs/:id/runs — get execution history
cronRoutes.get("/jobs/:id/runs", (c) => {
  const id = c.req.param("id");
  const runs = stmts.recentRuns.all(id);
  return c.json({ runs });
});

// POST /api/cron/jobs/:id/run — manually trigger a job
cronRoutes.post("/jobs/:id/run", async (c) => {
  const id = c.req.param("id");
  const job = stmts.getJob.get(id) as any;
  if (!job) return c.json({ error: "Job not found" }, 404);

  try {
    const args = splitCommand(job.command);
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 300000,
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = proc.exitCode ?? -1;
    const output = (stdout + (stderr ? "\nSTDERR:\n" + stderr : "")).slice(0, 10000);
    stmts.insertRun.run(job.id, output, exitCode);
    return c.json({ ok: true, exitCode, output: output.slice(0, 500) });
  } catch (e: any) {
    stmts.insertRun.run(job.id, `Error: ${e.message}`, -1);
    return c.json({ error: e.message }, 500);
  }
});

// GET /api/cron/health
cronRoutes.get("/health", (c) => c.json({ module: "cron", status: "ok" }));
