import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const ansibleRoutes = new OpenAPIHono();

// ── DB Setup ──
db.run(`
  CREATE TABLE IF NOT EXISTS ansible_runs (
    id TEXT PRIMARY KEY,
    playbook TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    extra_vars TEXT NOT NULL DEFAULT '{}',
    dry_run INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    output TEXT NOT NULL DEFAULT '',
    exit_code INTEGER,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_ansible_runs_status ON ansible_runs(status)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_ansible_runs_started ON ansible_runs(started_at)`);

// ── Safety: Playbook whitelist ──
const ALLOWED_PLAYBOOKS = [
  "site.yml",
  "reset.yml",
  "ping.yml",
];

// ── Validation helpers ──
function isValidPlaybook(name: string): boolean {
  return ALLOWED_PLAYBOOKS.includes(name);
}

function isValidTags(tags: string): boolean {
  if (!tags) return true;
  return /^[a-zA-Z0-9_,\-]+$/.test(tags);
}

function isValidExtraVars(vars: string): boolean {
  if (!vars || vars === "{}") return true;
  try {
    const parsed = JSON.parse(vars);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

// ── Prepared statements ──
const stmts = {
  getById: db.query("SELECT * FROM ansible_runs WHERE id = ?"),
  getRecent: db.query("SELECT id, playbook, tags, extra_vars, dry_run, status, exit_code, started_at, completed_at FROM ansible_runs ORDER BY started_at DESC LIMIT ? OFFSET ?"),
  getRunning: db.query("SELECT id FROM ansible_runs WHERE status = 'running' LIMIT 1"),
  getRecentDryRun: db.query(`
    SELECT id FROM ansible_runs
    WHERE playbook = ? AND tags = ? AND extra_vars = ? AND dry_run = 1 AND status = 'success'
      AND started_at > datetime('now', '-1 hour')
    ORDER BY started_at DESC LIMIT 1
  `),
  insert: db.query(
    "INSERT INTO ansible_runs (id, playbook, tags, extra_vars, dry_run, status) VALUES (?, ?, ?, ?, ?, 'running')"
  ),
  updateOutput: db.query("UPDATE ansible_runs SET output = ? WHERE id = ?"),
  complete: db.query("UPDATE ansible_runs SET status = ?, exit_code = ?, output = ?, completed_at = datetime('now') WHERE id = ?"),
  deleteRun: db.query("DELETE FROM ansible_runs WHERE id = ? AND status IN ('success', 'failed')"),
};

const ANSIBLE_REPO_PATH = process.env.ANSIBLE_REPO_PATH || "";
const ANSIBLE_SSH_HOST = process.env.ANSIBLE_SSH_HOST || "";
const ANSIBLE_SSH_KEY = process.env.ANSIBLE_SSH_KEY || "";

// ── Health ──
const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Ansible'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
ansibleRoutes.openapi(healthRoute, (c) => c.json({ module: "ansible", status: "ok" }, 200));

// ── GET /playbooks ──
const playbooksRoute = createRoute({ method: 'get', path: '/playbooks', tags: ['Ansible'], description: 'List allowed playbooks', responses: { 200: { content: { 'application/json': { schema: z.object({ playbooks: z.array(z.string()) }) } }, description: 'Playbook list' } } });
ansibleRoutes.openapi(playbooksRoute, (c) => {
  return c.json({ playbooks: ALLOWED_PLAYBOOKS }, 200);
});

// ── GET /runs ──
const runsRoute = createRoute({ method: 'get', path: '/runs', tags: ['Ansible'], description: 'List recent ansible runs', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Run list' } } });
ansibleRoutes.openapi(runsRoute, (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const runs = stmts.getRecent.all(limit, offset);
  return c.json({ runs }, 200);
});

// ── GET /runs/:id ──
const runDetailRoute = createRoute({ method: 'get', path: '/runs/{id}', tags: ['Ansible'], description: 'Get run details', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Run detail' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
ansibleRoutes.openapi(runDetailRoute, (c) => {
  const id = c.req.valid('param').id;
  const run = stmts.getById.get(id);
  if (!run) return c.json({ error: "Run not found" } as any, 404);
  return c.json({ run }, 200);
});

// ── POST /run ──
const runRoute = createRoute({ method: 'post', path: '/run', tags: ['Ansible'], description: 'Execute an ansible playbook', request: { body: { content: { 'application/json': { schema: z.object({ playbook: z.string(), tags: z.string().optional(), extra_vars: z.record(z.string(), z.unknown()).optional(), dry_run: z.boolean().optional() }) } } } }, responses: { 202: { content: { 'application/json': { schema: z.object({ id: z.string(), status: z.string() }) } }, description: 'Run started' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 409: { content: { 'application/json': { schema: z.any() } }, description: 'Conflict - another run in progress' } } });
ansibleRoutes.openapi(runRoute, async (c) => {
  const body = c.req.valid('json');

  const { playbook, tags = "", dry_run = false } = body;
  const extraVarsStr = JSON.stringify(body.extra_vars || {});

  // Validate playbook against whitelist (prevents path traversal + shell injection)
  if (!playbook || !isValidPlaybook(playbook)) {
    return c.json({ error: `Playbook not allowed. Allowed: ${ALLOWED_PLAYBOOKS.join(", ")}` } as any, 400);
  }

  // Validate tags (alphanumeric, comma, hyphen, underscore only)
  if (!isValidTags(tags)) {
    return c.json({ error: "Tags must be alphanumeric characters separated by commas" } as any, 400);
  }

  // Validate extra_vars is valid JSON object
  if (!isValidExtraVars(extraVarsStr)) {
    return c.json({ error: "extra_vars must be a valid JSON object" } as any, 400);
  }

  // Max 1 concurrent execution
  const running = stmts.getRunning.get();
  if (running) {
    return c.json({ error: "Another playbook is currently running. Wait for it to finish.", running_id: (running as any).id } as any, 409);
  }

  // If not a dry run, require a recent successful dry run with same params
  if (!dry_run) {
    const recentDry = stmts.getRecentDryRun.get(playbook, tags, extraVarsStr);
    if (!recentDry) {
      return c.json({ error: "A successful dry run with the same parameters is required before executing. Run a dry run first." } as any, 400);
    }
  }

  // Create run record
  const id = crypto.randomUUID();
  stmts.insert.run(id, playbook, tags, extraVarsStr, dry_run ? 1 : 0);

  // Build command args
  const args: string[] = [];

  if (ANSIBLE_SSH_HOST) {
    // Run via SSH to the ansible host
    args.push("ssh");
    if (ANSIBLE_SSH_KEY) {
      args.push("-i", ANSIBLE_SSH_KEY);
    }
    args.push("-o", "StrictHostKeyChecking=no", ANSIBLE_SSH_HOST);
    // Build the remote command
    const remoteArgs = buildAnsibleArgs(playbook, tags, extraVarsStr, dry_run);
    if (ANSIBLE_REPO_PATH) {
      args.push(`cd ${ANSIBLE_REPO_PATH} && ${remoteArgs.join(" ")}`);
    } else {
      args.push(remoteArgs.join(" "));
    }
  } else {
    // Run locally
    args.push(...buildAnsibleArgs(playbook, tags, extraVarsStr, dry_run));
  }

  // Spawn subprocess asynchronously
  spawnPlaybook(id, args, ANSIBLE_SSH_HOST ? undefined : ANSIBLE_REPO_PATH || undefined);

  return c.json({ id, status: "running" }, 202);
});

function buildAnsibleArgs(playbook: string, tags: string, extraVarsStr: string, dryRun: boolean): string[] {
  const args = ["ansible-playbook", "-i", "inventory/my-cluster/hosts.ini", playbook];
  if (tags) args.push("--tags", tags);
  if (extraVarsStr && extraVarsStr !== "{}") args.push("--extra-vars", extraVarsStr);
  if (dryRun) args.push("--check", "--diff");
  return args;
}

async function spawnPlaybook(id: string, args: string[], cwd?: string) {
  let output = "";
  try {
    const proc = Bun.spawn(args, {
      cwd: cwd || undefined,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ANSIBLE_FORCE_COLOR: "0", ANSIBLE_NOCOLOR: "1" },
    });

    // Read stdout
    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();
    const decoder = new TextDecoder();

    async function readStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
        // Update DB periodically with accumulated output
        stmts.updateOutput.run(output, id);
      }
    }

    await Promise.all([readStream(stdoutReader), readStream(stderrReader)]);

    const exitCode = await proc.exited;
    const status = exitCode === 0 ? "success" : "failed";
    stmts.complete.run(status, exitCode, output, id);
  } catch (err: any) {
    output += `\n\nERROR: ${err.message}`;
    stmts.complete.run("failed", -1, output, id);
  }
}

// ── GET /runs/:id/stream — SSE live log streaming (kept as regular route) ──
ansibleRoutes.get("/runs/:id/stream", (c) => {
  const id = c.req.param("id");
  const run = stmts.getById.get(id) as any;
  if (!run) return c.json({ error: "Run not found" }, 404);

  let lastLen = 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const current = stmts.getById.get(id) as any;
        if (!current) {
          clearInterval(interval);
          controller.close();
          return;
        }

        if (current.output.length > lastLen) {
          const newOutput = current.output.slice(lastLen);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: newOutput })}\n\n`));
          lastLen = current.output.length;
        }

        if (current.status !== "running") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, exit_code: current.exit_code, status: current.status })}\n\n`));
          clearInterval(interval);
          controller.close();
        }
      }, 500);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

// ── DELETE /runs/:id ──
const deleteRunRoute = createRoute({ method: 'delete', path: '/runs/{id}', tags: ['Ansible'], description: 'Delete a completed run', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Deleted' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Cannot delete running' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
ansibleRoutes.openapi(deleteRunRoute, (c) => {
  const id = c.req.valid('param').id;
  const run = stmts.getById.get(id) as any;
  if (!run) return c.json({ error: "Run not found" } as any, 404);
  if (run.status === "running") {
    return c.json({ error: "Cannot delete a running playbook" } as any, 400);
  }
  stmts.deleteRun.run(id);
  return c.json({ deleted: id }, 200);
});
