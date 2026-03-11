import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const logsRoutes = new OpenAPIHono();

const DOCKER_HOST = process.env.DOCKER_HOST || "http://localhost:2375";
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/;
const UNIT_NAME_RE = /^[a-zA-Z0-9._@:-]+$/;

async function dockerApi(path: string): Promise<any> {
  const res = await fetch(`${DOCKER_HOST}${path}`);
  if (!res.ok) throw new Error(`Docker API ${res.status}: ${await res.text()}`);
  return res;
}

const sourcesRoute = createRoute({
  method: 'get', path: '/sources', tags: ['Logs'],
  description: 'List available log sources (containers)',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Log sources' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
logsRoutes.openapi(sourcesRoute, async (c) => {
  try {
    const res = await dockerApi("/containers/json?all=true");
    const containers = await res.json();
    const sources = containers.map((ct: any) => ({ id: ct.Id.slice(0, 12), name: (ct.Names?.[0] || "").replace(/^\//, ""), state: ct.State, type: "container" }));
    return c.json({ sources }, 200);
  } catch (e: any) {
    return c.json({ sources: [], error: e.message } as any, 500);
  }
});

const containerLogsRoute = createRoute({
  method: 'get', path: '/container/{id}', tags: ['Logs'],
  description: 'Get container logs',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ lines: z.array(z.string()), containerId: z.string(), count: z.number() }) } }, description: 'Container logs' },
    400: { content: { 'application/json': { schema: z.any() } }, description: 'Validation error' },
    500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' },
  }
});
logsRoutes.openapi(containerLogsRoute, async (c) => {
  const id = c.req.valid('param').id;
  if (!CONTAINER_ID_RE.test(id)) return c.json({ lines: [], error: "Invalid container ID" } as any, 400);
  const tailRaw = c.req.query("tail") || "200";
  const tail = String(Math.min(Math.max(parseInt(tailRaw) || 200, 1), 10000));
  const sinceRaw = c.req.query("since") || "";
  const since = /^(\d+|[\d\-T:.Z]+)$/.test(sinceRaw) ? sinceRaw : "";
  try {
    let url = `/containers/${id}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`;
    if (since) url += `&since=${encodeURIComponent(since)}`;
    const res = await dockerApi(url);
    const raw = await res.text();
    const lines = raw.split("\n").map((line: string) => {
      if (line.length > 8) { const header = line.charCodeAt(0); if (header === 1 || header === 2) return line.slice(8); }
      return line;
    }).filter(Boolean);
    return c.json({ lines, containerId: id, count: lines.length }, 200);
  } catch (e: any) {
    return c.json({ lines: [], error: e.message } as any, 500);
  }
});

const systemLogsRoute = createRoute({
  method: 'get', path: '/system', tags: ['Logs'],
  description: 'Read system journal logs',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'System logs' }, 400: { content: { 'application/json': { schema: z.any() } }, description: 'Validation error' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
logsRoutes.openapi(systemLogsRoute, async (c) => {
  const unit = c.req.query("unit") || "";
  const linesRaw = c.req.query("lines") || "200";
  const lines = String(Math.min(Math.max(parseInt(linesRaw) || 200, 1), 10000));
  if (unit && !UNIT_NAME_RE.test(unit)) return c.json({ lines: [], error: "Invalid unit name" } as any, 400);
  try {
    const args = ["journalctl", "--no-pager", "-n", lines, "-o", "short-iso"];
    if (unit) args.push("-u", unit);
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const text = await new Response(proc.stdout).text();
    const logLines = text.split("\n").filter(Boolean);
    return c.json({ lines: logLines, unit: unit || "all", count: logLines.length }, 200);
  } catch (e: any) {
    return c.json({ lines: [], error: "journalctl not available: " + e.message } as any, 500);
  }
});

const systemUnitsRoute = createRoute({
  method: 'get', path: '/system/units', tags: ['Logs'],
  description: 'List available systemd units',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Unit list' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
logsRoutes.openapi(systemUnitsRoute, async (c) => {
  try {
    const proc = Bun.spawn(["systemctl", "list-units", "--type=service", "--no-pager", "--no-legend"], { stdout: "pipe" });
    const text = await new Response(proc.stdout).text();
    const units = text.split("\n").filter(Boolean).map((line) => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[0], load: parts[1], active: parts[2], sub: parts[3] };
    });
    return c.json({ units }, 200);
  } catch (e: any) {
    return c.json({ units: [], error: e.message } as any, 500);
  }
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Logs'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
logsRoutes.openapi(healthRoute, (c) => c.json({ module: "logs", status: "ok" }, 200));
