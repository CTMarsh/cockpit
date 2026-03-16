import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const cronRoutes = new OpenAPIHono();

const MAX_COMMAND_LENGTH = 1000;
const SAFE_COMMAND_PATTERN = /^[a-zA-Z0-9 /._=:,+%\-\[\]]+$/;
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
  const jobs = await sql`SELECT * FROM cron_jobs ORDER BY created_at DESC` as any[];
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
      await sql`INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (${job.id}, ${output}, ${exitCode}, NOW())`;
    } catch (e: any) {
      await sql`INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (${job.id}, ${`Error: ${e.message}`}, ${-1}, NOW())`;
    }
  }
}, 60000);

const listJobsRoute = createRoute({
  method: 'get', path: '/jobs', tags: ['Cron'],
  description: 'List all cron jobs with last run info',
  responses: { 200: { content: { 'application/json': { schema: z.object({ jobs: z.array(z.any()) }) } }, description: 'Job list' } }
});
cronRoutes.openapi(listJobsRoute, async (c) => {
  const jobs = await sql`SELECT * FROM cron_jobs ORDER BY created_at DESC` as any[];
  const lastRuns = await sql`SELECT cr.* FROM cron_runs cr INNER JOIN (SELECT job_id, MAX(started_at) as max_start FROM cron_runs GROUP BY job_id) latest ON cr.job_id = latest.job_id AND cr.started_at = latest.max_start` as any[];
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
  const enabledVal = enabled !== false ? 1 : 0;
  await sql`INSERT INTO cron_jobs (id, name, schedule, command, enabled) VALUES (${id}, ${name}, ${schedule.trim()}, ${command}, ${enabledVal})`;
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
  const [existing] = await sql`SELECT * FROM cron_jobs WHERE id = ${id}` as any[];
  if (!existing) return c.json({ error: "Job not found" } as any, 404);
  const { name, schedule, command, enabled } = c.req.valid('json');
  if (name !== undefined && name.length > 200) return c.json({ error: "Name must be 200 characters or fewer" } as any, 400);
  if (command !== undefined) { const cmdError = validateCommand(command); if (cmdError) return c.json({ error: cmdError } as any, 400); }
  const newName = name ?? existing.name;
  const newSchedule = schedule ?? existing.schedule;
  const newCommand = command ?? existing.command;
  const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled;
  await sql`UPDATE cron_jobs SET name = ${newName}, schedule = ${newSchedule}, command = ${newCommand}, enabled = ${newEnabled}, updated_at = NOW() WHERE id = ${id}`;
  return c.json({ ok: true }, 200);
});

const deleteJobRoute = createRoute({
  method: 'delete', path: '/jobs/{id}', tags: ['Cron'],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Job deleted' } }
});
cronRoutes.openapi(deleteJobRoute, async (c) => {
  await sql`DELETE FROM cron_jobs WHERE id = ${c.req.valid('param').id}`;
  return c.json({ ok: true }, 200);
});

const jobRunsRoute = createRoute({
  method: 'get', path: '/jobs/{id}/runs', tags: ['Cron'],
  description: 'Get job execution history',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Run history' } }
});
cronRoutes.openapi(jobRunsRoute, async (c) => {
  const runs = await sql`SELECT * FROM cron_runs WHERE job_id = ${c.req.valid('param').id} ORDER BY started_at DESC LIMIT 20`;
  return c.json({ runs }, 200);
});

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
  const [job] = await sql`SELECT * FROM cron_jobs WHERE id = ${id}` as any[];
  if (!job) return c.json({ error: "Job not found" } as any, 404);
  try {
    const args = splitCommand(job.command);
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe", timeout: 300000 });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = proc.exitCode ?? -1;
    const output = (stdout + (stderr ? "\nSTDERR:\n" + stderr : "")).slice(0, 10000);
    await sql`INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (${job.id}, ${output}, ${exitCode}, NOW())`;
    return c.json({ ok: true, exitCode, output: output.slice(0, 500) }, 200);
  } catch (e: any) {
    await sql`INSERT INTO cron_runs (job_id, output, exit_code, finished_at) VALUES (${job.id}, ${`Error: ${e.message}`}, ${-1}, NOW())`;
    return c.json({ error: e.message } as any, 500);
  }
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Cron'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
cronRoutes.openapi(healthRoute, (c) => c.json({ module: "cron", status: "ok" }, 200));
