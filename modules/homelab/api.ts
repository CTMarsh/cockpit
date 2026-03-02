import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const homelabRoutes = new Hono();

interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  icon?: string;
  expected_status: number;
}

interface ServiceStatus {
  id: string;
  name: string;
  url: string;
  icon?: string;
  status: "up" | "down" | "unknown";
  responseTime: number | null;
  lastChecked: string;
  statusCode: number | null;
}

const stmts = {
  getAll: db.query("SELECT * FROM services ORDER BY created_at ASC"),
  insert: db.query("INSERT INTO services (id, name, url, icon, expected_status) VALUES (?, ?, ?, ?, ?)"),
  delete: db.query("DELETE FROM services WHERE id = ?"),
};

async function checkService(service: ServiceConfig): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(service.url, { signal: controller.signal });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: res.status === service.expected_status ? "up" : "down",
      responseTime,
      lastChecked: new Date().toISOString(),
      statusCode: res.status,
    };
  } catch {
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: "down",
      responseTime: null,
      lastChecked: new Date().toISOString(),
      statusCode: null,
    };
  }
}

homelabRoutes.get("/health", (c) => c.json({ module: "homelab", status: "ok" }));

homelabRoutes.get("/services", async (c) => {
  const services = stmts.getAll.all() as ServiceConfig[];
  const statuses = await Promise.all(services.map(checkService));
  return c.json({
    services: statuses,
    summary: {
      total: statuses.length,
      up: statuses.filter((s) => s.status === "up").length,
      down: statuses.filter((s) => s.status === "down").length,
    },
  });
});

homelabRoutes.post("/services", async (c) => {
  const body = await c.req.json<{ name: string; url: string; icon?: string; expectedStatus?: number }>();
  if (!body.name || !body.url) return c.json({ error: "name and url are required" }, 400);
  const id = body.name.toLowerCase().replace(/\s+/g, "-");
  const expectedStatus = body.expectedStatus || 200;
  stmts.insert.run(id, body.name, body.url, body.icon || null, expectedStatus);
  return c.json({ id, name: body.name, url: body.url }, 201);
});

homelabRoutes.delete("/services/:id", (c) => {
  const id = c.req.param("id");
  stmts.delete.run(id);
  return c.json({ deleted: id });
});

homelabRoutes.get("/containers", async (c) => {
  try {
    const dockerHost = process.env.DOCKER_HOST || "http://localhost:2375";
    const res = await fetch(`${dockerHost}/containers/json?all=true`);
    if (!res.ok) throw new Error(`Docker API returned ${res.status}`);
    const containers = await res.json();
    return c.json({
      containers: containers.map((ct: any) => ({
        id: ct.Id?.slice(0, 12),
        name: ct.Names?.[0]?.replace(/^\//, ""),
        image: ct.Image,
        state: ct.State,
        status: ct.Status,
        ports: ct.Ports?.map((p: any) => `${p.PublicPort || ""}:${p.PrivatePort}/${p.Type}`).filter(Boolean),
        created: ct.Created,
      })),
    });
  } catch {
    return c.json({
      containers: [],
      error: "Docker API not available. Set DOCKER_HOST env var or expose Docker TCP API.",
    });
  }
});
