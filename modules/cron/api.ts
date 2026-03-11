import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const cronRoutes = new OpenAPIHono();

db.run(`CREATE TABLE IF NOT EXISTS cron_jobs (id TEXT PRIMARY KEY, name TEXT NOT NULL, schedule TEXT NOT NULL, command TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`);
db.run(`CREATE TABLE IF NOT EXISTS cron_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, started_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT, exit_code INTEGER, output TEXT NOT NULL DEFAULT '', FOREIGN KEY (job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id, started_at)`);

const MAX_COMMAND_LENGTH = 1000;
const SAFE_COMMAND_PATTERN = /^[a-zA-Z0-9 /._=:,@+%\-\[\]]+$/;
const BLOCKED_COMMANDS = ['rm', 'dd', 'mkfs', 'fdisk', 'kill', 'killall', 'shutdown', 'reboot', 'halt', 'poweroff'];

function validateCommand(command: string): string | null {
  if (!command || command.length > MAX_COMMAND_LENGTH) return "Command too long or empty";
  if (!SAFE_COMMAND_PATTERN.test(command)) return "Command contains disallowed characters. Only alphanumeric, spaces, slashes, dots, hyphens, underscores, equals, colons, and commas are allowed.";
  const binary = command.trim().split(/\s+/)[0];
  const binaryName = binary.split("/").pop() || binary;
  if (BLOCKED_COMMANDS.includes(binaryName.toLowerCase())) return `Command '${binaryName}' is blocked for safety. Blocked commands: ${BLOCKED_COMMANDS.join(", ")}`;
  return null;
}

function splitCommand(command: string): string[] { return command.trim().split(/\s+/).filter(Boolean); }

const stmts = {
  listJobs: db.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC"),
  getJob: db.prepare("SELECT * FROM cron_jobs WHERE id = ?"),
  insertJob: db.prepare("INSERT INTO cron_jobs (id, name, schedule, command, enabled) VALUES (?, ?, ?, ?, ?)"),
  updateJob: db.prepare("UPDATE cron_jobs SET name = ?, schedule = ?, command = ?, enabled = ?, updated_at = datetime('now') WHERE id = ?"),
  deleteJob: db.prepare("DELETE FROM cron_jobs WHERE id = ?"),
  insertRun: db.prepare("INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (?, ?, ?, datetime('now'))"),
  recentRuns: db.prepare("SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 20"),
  lastRun: db.prepare("SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT 1"),
  allLastRuns: db.prepare(`SELECT cr.* FROM cron_runs cr INNER JOIN (SELECT job_id, MAX(started_at) as max_start FROM cron_runs GROUP BY job_id) latest ON cr.job_id = latest.job_id AND cr.started_at = latest.max_start`),
};

function matchesCron(schedule: string, date: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fields = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()];
  return parts.every((part, i) => {
    if (part === "*") return true;
    if (part.startsWith("*/")) { const step = parseInt(part.slice(2)); return step > 0 && fields[i] % step === 0; }
    if (part.includes(",")) return part.split(",").map(Number).includes(fields[i]);
    if (part.includes("-")) { const [min, max] = part.split("-").map(Number); return fields[i] >= min && fields[i] <= max; }
    return parseInt(part) === fields[i];
  });
}

setInterval(async () => {
  const now = new Date();
  const jobs = stmts.listJobs.all() as any[];
  for (const job of jobs) {
    if (!job.enabled) continue;
    if (!matchesCron(job.schedule, now)) continue;
    try {
      const args = splitCommand(job.command);
      const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", timeout: 300000 });
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = proc.exitCode ?? -1;
      const output = (stdout + (stderr ? "\nSTDERR:\n" + stderr : "")).slice(0, 10000);
      stmts.insertRun.run(job.id, output, exitCode);
    } catch (e: any) { stmts.insertRun.run(job.id, `Error: ${e.message}`, -1); }
  }
}, 60000);

const listJobsRoute = createRoute({
  method: 'get', path: '/jobs', tags: ['Cron'],
  description: 'List all cron jobs with last run info',
  responses: { 200: { content: { 'application/json': { schema: z.object({ jobs: z.array(z.any()) }) } }, description: 'Job list' } }
});
cronRoutes.openapi(listJobsRoute, (c) => {
  const jobs = stmts.listJobs.all() as any[];
  const lastRuns = stmts.allLastRuns.all() as any[];
  const runMap = new Map(lastRuns.map((r: any) => [r.job_id, r]));
  const result = jobs.map((j) => ({ ...j, enabled: !!j.enabled, lastRun: runMap.get(j.id) || null }));
  return c.json({ jobs: result }, 200);
});

const createJobRoute = createRoute({
  method: 'post', path: '/jobs', tags: ['Cron'],
  description: 'Create a new cron job',
  request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), schedule: z.string(), command: z.string(), enabled: z.boolean().optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Job created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
cronRoutes.openapi(createJobRoute, async (c) => {
  const { name, schedule, command, enabled } = c.req.valid('json');
  if (!name || !schedule || !command) return c.json({ error: "name, schedule, and command are required" } as any, 400);
  if (name.length > 200) return c.json({ error: "Name must be 200 characters or fewer" } as any, 400);
  if (schedule.trim().split(/\s+/).length !== 5) return c.json({ error: "Invalid cron expression. Use: minute hour day month weekday" } as any, 400);
  const cmdError = validateCommand(command);
  if (cmdError) return c.json({ error: cmdError } as any, 400);
  const id = crypto.randomUUID();
  stmts.insertJob.run(id, name, schedule.trim(), command, enabled !== false ? 1 : 0);
  return c.json({ id, name, schedule, command, enabled: enabled !== false }, 200);
});

const updateJobRoute = createRoute({
  method: 'put', path: '/jobs/{id}', tags: ['Cron'],
  description: 'Update a cron job',
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), schedule: z.string().optional(), command: z.string().optional(), enabled: z.boolean().optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Job updated' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
cronRoutes.openapi(updateJobRoute, async (c) => {
  const id = c.req.valid('param').id;
  const existing = stmts.getJob.get(id) as any;
  if (!existing) return c.json({ error: "Job not found" } as any, 404);
  const { name, schedule, command, enabled } = c.req.valid('json');
  if (name !== undefined && name.length > 200) return c.json({ error: "Name must be 200 characters or fewer" } as any, 400);
  if (command !== undefined) { const cmdError = validateCommand(command); if (cmdError) return c.json({ error: cmdError } as any, 400); }
  stmts.updateJob.run(name ?? existing.name, schedule ?? existing.schedule, command ?? existing.command, enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled, id);
  return c.json({ ok: true }, 200);
});

const deleteJobRoute = createRoute({
  method: 'delete', path: '/jobs/{id}', tags: ['Cron'],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Job deleted' } }
});
cronRoutes.openapi(deleteJobRoute, (c) => { stmts.deleteJob.run(c.req.valid('param').id); return c.json({ ok: true }, 200); });

const jobRunsRoute = createRoute({
  method: 'get', path: '/jobs/{id}/runs', tags: ['Cron'],
  description: 'Get job execution history',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Run history' } }
});
cronRoutes.openapi(jobRunsRoute, (c) => { const runs = stmts.recentRuns.all(c.req.valid('param').id); return c.json({ runs }, 200); });

const manualRunRoute = createRoute({
  method: 'post', path: '/jobs/{id}/run', tags: ['Cron'],
  description: 'Manually trigger a cron job',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Run result' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' },
  }
});
cronRoutes.openapi(manualRunRoute, async (c) => {
  const id = c.req.valid('param').id;
  const job = stmts.getJob.get(id) as any;
  if (!job) return c.json({ error: "Job not found" } as any, 404);
  try {
    const args = splitCommand(job.command);
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", timeout: 300000 });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = proc.exitCode ?? -1;
    const output = (stdout + (stderr ? "\nSTDERR:\n" + stderr : "")).slice(0, 10000);
    stmts.insertRun.run(job.id, output, exitCode);
    return c.json({ ok: true, exitCode, output: output.slice(0, 500) }, 200);
  } catch (e: any) {
    stmts.insertRun.run(job.id, `Error: ${e.message}`, -1);
    return c.json({ error: e.message } as any, 500);
  }
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Cron'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
cronRoutes.openapi(healthRoute, (c) => c.json({ module: "cron", status: "ok" }, 200));
