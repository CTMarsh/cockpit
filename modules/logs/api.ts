import { Hono } from "hono";

export const logsRoutes = new Hono();

const DOCKER_HOST = process.env.DOCKER_HOST || "http://localhost:2375";

// Validation: Docker container ID must be hex (12 or 64 chars)
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/;
// Validation: systemd unit name
const UNIT_NAME_RE = /^[a-zA-Z0-9._@:-]+$/;

async function dockerApi(path: string): Promise<any> {
  const res = await fetch(`${DOCKER_HOST}${path}`);
  if (!res.ok) throw new Error(`Docker API ${res.status}: ${await res.text()}`);
  return res;
}

// GET /api/logs/sources — list available log sources (containers)
logsRoutes.get("/sources", async (c) => {
  try {
    const res = await dockerApi("/containers/json?all=true");
    const containers = await res.json();
    const sources = containers.map((ct: any) => ({
      id: ct.Id.slice(0, 12),
      name: (ct.Names?.[0] || "").replace(/^\//, ""),
      state: ct.State,
      type: "container",
    }));
    return c.json({ sources });
  } catch (e: any) {
    return c.json({ sources: [], error: e.message }, 500);
  }
});

// GET /api/logs/container/:id — get container logs
logsRoutes.get("/container/:id", async (c) => {
  const id = c.req.param("id");
  if (!CONTAINER_ID_RE.test(id)) {
    return c.json({ lines: [], error: "Invalid container ID" }, 400);
  }

  const tailRaw = c.req.query("tail") || "200";
  const tail = String(Math.min(Math.max(parseInt(tailRaw) || 200, 1), 10000));
  const sinceRaw = c.req.query("since") || "";
  // Validate since as numeric Unix timestamp or ISO date
  const since = /^(\d+|[\d\-T:.Z]+)$/.test(sinceRaw) ? sinceRaw : "";

  try {
    let url = `/containers/${id}/logs?stdout=true&stderr=true&tail=${tail}&timestamps=true`;
    if (since) url += `&since=${encodeURIComponent(since)}`;

    const res = await dockerApi(url);
    const raw = await res.text();

    // Docker log multiplexing: each line prefixed with 8-byte header
    // Strip the header bytes for clean output
    const lines = raw.split("\n").map((line: string) => {
      // Remove Docker stream header (first 8 bytes if present)
      if (line.length > 8) {
        const header = line.charCodeAt(0);
        if (header === 1 || header === 2) {
          return line.slice(8);
        }
      }
      return line;
    }).filter(Boolean);

    return c.json({ lines, containerId: id, count: lines.length });
  } catch (e: any) {
    return c.json({ lines: [], error: e.message }, 500);
  }
});

// GET /api/logs/system — read system journal (if available)
logsRoutes.get("/system", async (c) => {
  const unit = c.req.query("unit") || "";
  const linesRaw = c.req.query("lines") || "200";
  const lines = String(Math.min(Math.max(parseInt(linesRaw) || 200, 1), 10000));

  // Validate unit name to prevent argument injection
  if (unit && !UNIT_NAME_RE.test(unit)) {
    return c.json({ lines: [], error: "Invalid unit name" }, 400);
  }

  try {
    const args = ["journalctl", "--no-pager", "-n", lines, "-o", "short-iso"];
    if (unit) args.push("-u", unit);

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const text = await new Response(proc.stdout).text();
    const logLines = text.split("\n").filter(Boolean);

    return c.json({ lines: logLines, unit: unit || "all", count: logLines.length });
  } catch (e: any) {
    return c.json({ lines: [], error: "journalctl not available: " + e.message }, 500);
  }
});

// GET /api/logs/system/units — list available systemd units
logsRoutes.get("/system/units", async (c) => {
  try {
    const proc = Bun.spawn(["systemctl", "list-units", "--type=service", "--no-pager", "--no-legend"], { stdout: "pipe" });
    const text = await new Response(proc.stdout).text();
    const units = text.split("\n").filter(Boolean).map((line) => {
      const parts = line.trim().split(/\s+/);
      return { name: parts[0], load: parts[1], active: parts[2], sub: parts[3] };
    });
    return c.json({ units });
  } catch (e: any) {
    return c.json({ units: [], error: e.message }, 500);
  }
});

// GET /api/logs/health
logsRoutes.get("/health", (c) => c.json({ module: "logs", status: "ok" }));
