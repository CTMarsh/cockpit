import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const notifyRoutes = new OpenAPIHono();

const NOTIFY_URL = process.env.NOTIFY_URL || "http://localhost:4100";

async function notifyAdmin(path: string, options?: RequestInit) {
  const cookie = await getAdminCookie();
  const res = await fetch(`${NOTIFY_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...options?.headers }, signal: AbortSignal.timeout(10000) });
  return res;
}

let cachedCookie: string | null = null;
let cookieExpiry = 0;

async function getAdminCookie(): Promise<string | null> {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;
  const user = process.env.NOTIFY_ADMIN_USER; const pass = process.env.NOTIFY_ADMIN_PASS;
  if (!user || !pass) return null;
  try {
    const res = await fetch(`${NOTIFY_URL}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user, password: pass }), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) { cachedCookie = setCookie.split(";")[0]; cookieExpiry = Date.now() + 23 * 60 * 60 * 1000; return cachedCookie; }
  } catch { /* unreachable */ }
  return null;
}

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Notify'], description: 'Notify service health', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Health status' }, 503: { content: { 'application/json': { schema: z.any() } }, description: 'Unreachable' } } });
notifyRoutes.openapi(healthRoute, async (c) => {
  try {
    const res = await fetch(`${NOTIFY_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as Record<string, any>;
    return c.json({ reachable: true, status: data.status, version: data.version, uptime: data.uptime, apns_configured: data.apns_configured, projects_count: data.stats?.projects ?? data.projects_count, devices_count: data.stats?.active_devices ?? data.devices_count } as any, 200);
  } catch (e: any) { return c.json({ reachable: false, error: e.message } as any, 503); }
});

const configRoute = createRoute({ method: 'get', path: '/config', tags: ['Notify'], responses: { 200: { content: { 'application/json': { schema: z.object({ notify_url: z.string(), admin_configured: z.boolean() }) } }, description: 'Config' } } });
notifyRoutes.openapi(configRoute, (c) => c.json({ notify_url: NOTIFY_URL, admin_configured: !!(process.env.NOTIFY_ADMIN_USER && process.env.NOTIFY_ADMIN_PASS) }, 200));

// Proxy routes — these forward to the notify service. Using regular routes since response schemas vary.
const projectsRoute = createRoute({ method: 'get', path: '/projects', tags: ['Notify'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Projects' } } });
notifyRoutes.openapi(projectsRoute, async (c) => {
  const res = await notifyAdmin("/api/projects");
  if (!res.ok) return c.json({ error: "Failed to fetch projects" } as any, res.status as any);
  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects || [];
  return c.json({ projects }, 200);
});

notifyRoutes.post("/projects", async (c) => { const body = await c.req.json(); const res = await notifyAdmin("/api/projects", { method: "POST", body: JSON.stringify(body) }); return c.json(await res.json(), res.status as any); });
notifyRoutes.put("/projects/:id", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const body = await c.req.json(); const res = await notifyAdmin(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }); return c.json(await res.json(), res.status as any); });
notifyRoutes.delete("/projects/:id", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const res = await notifyAdmin(`/api/projects/${id}`, { method: "DELETE" }); return c.json(await res.json(), res.status as any); });
notifyRoutes.post("/projects/:id/regenerate-key", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const res = await notifyAdmin(`/api/projects/${id}/regenerate-key`, { method: "POST" }); return c.json(await res.json(), res.status as any); });

const devicesRoute = createRoute({ method: 'get', path: '/devices', tags: ['Notify'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Devices' } } });
notifyRoutes.openapi(devicesRoute, async (c) => {
  const query = c.req.query(); const params = new URLSearchParams(query);
  const res = await notifyAdmin(`/api/devices?${params.toString()}`);
  if (!res.ok) return c.json({ error: "Failed to fetch devices" } as any, res.status as any);
  const data = await res.json();
  const devices = Array.isArray(data) ? data : data.devices || [];
  return c.json({ devices }, 200);
});

notifyRoutes.patch("/devices/:id", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const body = await c.req.json(); const res = await notifyAdmin(`/api/devices/${id}`, { method: "PATCH", body: JSON.stringify(body) }); return c.json(await res.json(), res.status as any); });
notifyRoutes.delete("/devices/:id", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const res = await notifyAdmin(`/api/devices/${id}`, { method: "DELETE" }); return c.json(await res.json(), res.status as any); });
notifyRoutes.post("/devices/:id/test", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const res = await notifyAdmin(`/api/devices/${id}/test`, { method: "POST" }); return c.json(await res.json(), res.status as any); });
notifyRoutes.post("/devices/cleanup", async (c) => { const res = await notifyAdmin("/api/devices/cleanup", { method: "POST" }); return c.json(await res.json(), res.status as any); });

const notificationsRoute = createRoute({ method: 'get', path: '/notifications', tags: ['Notify'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Notifications' } } });
notifyRoutes.openapi(notificationsRoute, async (c) => {
  const query = c.req.query(); const params = new URLSearchParams(query);
  const res = await notifyAdmin(`/api/notifications?${params.toString()}`);
  if (!res.ok) return c.json({ error: "Failed to fetch notifications" } as any, res.status as any);
  return c.json(await res.json(), 200);
});

notifyRoutes.get("/notifications/:id", async (c) => { const id = c.req.param("id"); if (!/^\d+$/.test(id)) return c.json({ error: "Invalid ID" }, 400); const res = await notifyAdmin(`/api/notifications/${id}`); if (!res.ok) return c.json({ error: "Failed to fetch notification" }, res.status as any); return c.json(await res.json()); });

notifyRoutes.post("/test/:projectId", async (c) => {
  const projectId = c.req.param("projectId"); if (!/^\d+$/.test(projectId)) return c.json({ error: "Invalid project ID" }, 400);
  const projRes = await notifyAdmin(`/api/projects/${projectId}`); if (!projRes.ok) return c.json({ error: "Project not found" }, 404);
  const project = await projRes.json() as { slug: string; api_key: string };
  const webhookRes = await fetch(`${NOTIFY_URL}/api/webhook/${project.slug}`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": project.api_key }, body: JSON.stringify({ title: "🧪 Test Notification", body: `Test from Cockpit at ${new Date().toLocaleString()}`, data: { source: "cockpit-test" }, priority: "high" }), signal: AbortSignal.timeout(10000) });
  return c.json(await webhookRes.json(), webhookRes.status as any);
});

notifyRoutes.post("/send/:projectSlug", async (c) => {
  const slug = c.req.param("projectSlug"); const body = await c.req.json();
  const projRes = await notifyAdmin("/api/projects"); if (!projRes.ok) return c.json({ error: "Cannot reach notify service" }, 503);
  const { projects } = await projRes.json() as { projects: Array<{ slug: string; api_key: string }> };
  const project = projects.find((p: any) => p.slug === slug);
  if (!project) return c.json({ error: `Project '${slug}' not found` }, 404);
  const webhookRes = await fetch(`${NOTIFY_URL}/api/webhook/${slug}`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": project.api_key }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  return c.json(await webhookRes.json(), webhookRes.status as any);
});
