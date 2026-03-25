import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const homelabRoutes = new OpenAPIHono();

// ── SSRF prevention — block cloud metadata and localhost, allow homelab network ──
function isHomelabUrlSafe(urlString: string): { safe: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { safe: false, error: "Only http and https URLs are allowed" };
    }
    const hostname = url.hostname.toLowerCase();
    // Block localhost variants
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
      return { safe: false, error: "Localhost addresses are not allowed" };
    }
    // Block cloud metadata endpoint (169.254.169.254)
    if (/^169\.254\./.test(hostname)) {
      return { safe: false, error: "Link-local/metadata addresses are not allowed" };
    }
    // Block IPv6 loopback and link-local
    if (/^::1$/.test(hostname) || /^fe80:/i.test(hostname)) {
      return { safe: false, error: "Internal IPv6 addresses are not allowed" };
    }
    // Note: Private IPs (10.x, 172.16.x, 192.168.x) are intentionally ALLOWED
    // because homelab services legitimately monitor internal hosts on the LAN.
    return { safe: true };
  } catch {
    return { safe: false, error: "Invalid URL format" };
  }
}

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

async function checkService(service: ServiceConfig): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(service.url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    const isUp = service.expected_status === 0
      ? res.status < 500
      : res.status === service.expected_status;
    return {
      id: service.id,
      name: service.name,
      url: service.url,
      icon: service.icon,
      status: isUp ? "up" : "down",
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

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Homelab'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
homelabRoutes.openapi(healthRoute, (c) => c.json({ module: "homelab", status: "ok" }, 200));

const listServicesRoute = createRoute({
  method: 'get',
  path: '/services',
  tags: ['Homelab'],
  description: 'List all services with live status checks',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({
        services: z.array(z.object({
          id: z.string(), name: z.string(), url: z.string(), icon: z.string().nullable().optional(),
          status: z.string(), responseTime: z.number().nullable(), lastChecked: z.string(),
          statusCode: z.number().nullable(), uptimePercent: z.number(),
        })),
        summary: z.object({ total: z.number(), up: z.number(), down: z.number() }),
      }) } },
      description: 'Service statuses'
    }
  }
});
homelabRoutes.openapi(listServicesRoute, async (c) => {
  const services = await sql`SELECT * FROM services ORDER BY created_at ASC` as ServiceConfig[];
  const statuses = await Promise.all(services.map(checkService));

  for (const s of statuses) {
    await sql`INSERT INTO uptime_history (service_id, status, response_time) VALUES (${s.id}, ${s.status}, ${s.responseTime})`;
  }

  const uptimeRows = await sql`
    SELECT service_id,
      COUNT(*)::int as total,
      SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)::int as up_count
    FROM uptime_history
    WHERE checked_at > NOW() - INTERVAL '30 days'
    GROUP BY service_id
  ` as any[];
  const uptimeMap: Record<string, number> = {};
  for (const row of uptimeRows) {
    uptimeMap[row.service_id] = row.total > 0 ? Math.round((row.up_count / row.total) * 1000) / 10 : 0;
  }

  return c.json({
    services: statuses.map((s) => ({ ...s, uptimePercent: uptimeMap[s.id] ?? 100 })),
    summary: {
      total: statuses.length,
      up: statuses.filter((s) => s.status === "up").length,
      down: statuses.filter((s) => s.status === "down").length,
    },
  } as any, 200);
});

const serviceHistoryRoute = createRoute({
  method: 'get',
  path: '/services/{id}/history',
  tags: ['Homelab'],
  description: 'Get uptime history for a service',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Service history' }
  }
});
homelabRoutes.openapi(serviceHistoryRoute, async (c) => {
  const id = c.req.valid('param').id;
  const limit = Math.min(Number(c.req.query("limit")) || 100, 10000);
  const history = await sql`SELECT status, response_time, checked_at FROM uptime_history WHERE service_id = ${id} ORDER BY checked_at DESC LIMIT ${limit}`;
  return c.json({ history }, 200);
});

const createServiceRoute = createRoute({
  method: 'post',
  path: '/services',
  tags: ['Homelab'],
  description: 'Add a new service to monitor',
  request: {
    body: { content: { 'application/json': { schema: z.object({ name: z.string(), url: z.string(), icon: z.string().optional(), expectedStatus: z.number().optional() }) } } }
  },
  responses: {
    201: { content: { 'application/json': { schema: z.object({ id: z.string(), name: z.string(), url: z.string() }) } }, description: 'Service created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
homelabRoutes.openapi(createServiceRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.name || !body.url) return c.json({ error: "name and url are required" } as any, 400);
  const urlCheck = isHomelabUrlSafe(body.url);
  if (!urlCheck.safe) return c.json({ error: urlCheck.error } as any, 400);
  const id = body.name.toLowerCase().replace(/\s+/g, "-");
  const expectedStatus = body.expectedStatus ?? 0;
  await sql`INSERT INTO services (id, name, url, icon, expected_status) VALUES (${id}, ${body.name}, ${body.url}, ${body.icon || null}, ${expectedStatus})`;
  return c.json({ id, name: body.name, url: body.url }, 201);
});

const updateServiceRoute = createRoute({
  method: 'put',
  path: '/services/{id}',
  tags: ['Homelab'],
  description: 'Update an existing service',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), url: z.string().optional(), expectedStatus: z.number().optional() }) } } }
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string(), name: z.string(), url: z.string(), expectedStatus: z.number() }) } }, description: 'Service updated' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
homelabRoutes.openapi(updateServiceRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM services WHERE id = ${id}` as any[];
  if (!existing) return c.json({ error: "Service not found" } as any, 404);
  const body = c.req.valid('json');
  if (body.url) {
    const urlCheck = isHomelabUrlSafe(body.url);
    if (!urlCheck.safe) return c.json({ error: urlCheck.error } as any, 400);
  }
  const name = body.name ?? existing.name;
  const url = body.url ?? existing.url;
  const expectedStatus = body.expectedStatus ?? existing.expected_status;
  await sql`UPDATE services SET name = ${name}, url = ${url}, expected_status = ${expectedStatus} WHERE id = ${id}`;
  return c.json({ id, name, url, expectedStatus }, 200);
});

const deleteServiceRoute = createRoute({
  method: 'delete',
  path: '/services/{id}',
  tags: ['Homelab'],
  description: 'Delete a service',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Service deleted' }
  }
});
homelabRoutes.openapi(deleteServiceRoute, async (c) => {
  const id = c.req.valid('param').id;
  await sql`DELETE FROM services WHERE id = ${id}`;
  return c.json({ deleted: id }, 200);
});

