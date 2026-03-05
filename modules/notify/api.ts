import { Hono } from "hono";

export const notifyRoutes = new Hono();

const NOTIFY_URL = process.env.NOTIFY_URL || "http://localhost:4100";

// Helper: proxy request to notify service with admin session
async function notifyAdmin(path: string, options?: RequestInit) {
  // Login to notify service to get admin session cookie
  const cookie = await getAdminCookie();
  const res = await fetch(`${NOTIFY_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options?.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  return res;
}

// Cache admin cookie (re-login when expired)
let cachedCookie: string | null = null;
let cookieExpiry = 0;

async function getAdminCookie(): Promise<string | null> {
  if (cachedCookie && Date.now() < cookieExpiry) return cachedCookie;

  const user = process.env.NOTIFY_ADMIN_USER;
  const pass = process.env.NOTIFY_ADMIN_PASS;
  if (!user || !pass) return null;

  try {
    const res = await fetch(`${NOTIFY_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      cachedCookie = setCookie.split(";")[0];
      // Refresh 1 hour before expiry (sessions last 24h)
      cookieExpiry = Date.now() + 23 * 60 * 60 * 1000;
      return cachedCookie;
    }
  } catch {
    // Notify service unreachable
  }
  return null;
}

// ── GET /health — notify service health ──
notifyRoutes.get("/health", async (c) => {
  try {
    const res = await fetch(`${NOTIFY_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as Record<string, any>;
    // Map notify service response to frontend expected format
    return c.json({
      reachable: true,
      status: data.status,
      version: data.version,
      uptime: data.uptime,
      apns_configured: data.apns_configured,
      projects_count: data.stats?.projects ?? data.projects_count,
      devices_count: data.stats?.active_devices ?? data.devices_count,
    });
  } catch (e: any) {
    return c.json({ reachable: false, error: e.message }, 503);
  }
});

// ── GET /config — notify connection config ──
notifyRoutes.get("/config", (c) => {
  return c.json({
    notify_url: NOTIFY_URL,
    admin_configured: !!(process.env.NOTIFY_ADMIN_USER && process.env.NOTIFY_ADMIN_PASS),
  });
});

// ── Projects ──

notifyRoutes.get("/projects", async (c) => {
  const res = await notifyAdmin("/api/projects");
  if (!res.ok) return c.json({ error: "Failed to fetch projects" }, res.status as any);
  const data = await res.json();
  // Notify API returns a plain array; frontend expects { projects: [...] }
  const projects = Array.isArray(data) ? data : data.projects || [];
  return c.json({ projects });
});

notifyRoutes.post("/projects", async (c) => {
  const body = await c.req.json();
  const res = await notifyAdmin("/api/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return c.json(await res.json(), res.status as any);
});

notifyRoutes.put("/projects/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const res = await notifyAdmin(`/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return c.json(await res.json(), res.status as any);
});

notifyRoutes.delete("/projects/:id", async (c) => {
  const id = c.req.param("id");
  const res = await notifyAdmin(`/api/projects/${id}`, { method: "DELETE" });
  return c.json(await res.json(), res.status as any);
});

notifyRoutes.post("/projects/:id/regenerate-key", async (c) => {
  const id = c.req.param("id");
  const res = await notifyAdmin(`/api/projects/${id}/regenerate-key`, {
    method: "POST",
  });
  return c.json(await res.json(), res.status as any);
});

// ── Devices ──

notifyRoutes.get("/devices", async (c) => {
  const query = c.req.query();
  const params = new URLSearchParams(query);
  const res = await notifyAdmin(`/api/devices?${params.toString()}`);
  if (!res.ok) return c.json({ error: "Failed to fetch devices" }, res.status as any);
  const data = await res.json();
  // Notify API returns a plain array; frontend expects { devices: [...] }
  const devices = Array.isArray(data) ? data : data.devices || [];
  return c.json({ devices });
});

// ── Notifications ──

notifyRoutes.get("/notifications", async (c) => {
  const query = c.req.query();
  const params = new URLSearchParams(query);
  const res = await notifyAdmin(`/api/notifications?${params.toString()}`);
  if (!res.ok) return c.json({ error: "Failed to fetch notifications" }, res.status as any);
  return c.json(await res.json());
});

notifyRoutes.get("/notifications/:id", async (c) => {
  const id = c.req.param("id");
  const res = await notifyAdmin(`/api/notifications/${id}`);
  if (!res.ok) return c.json({ error: "Failed to fetch notification" }, res.status as any);
  return c.json(await res.json());
});

// ── Send Test Notification ──

notifyRoutes.post("/test/:projectId", async (c) => {
  // Get project details to get slug and API key
  const projectId = c.req.param("projectId");
  const projRes = await notifyAdmin(`/api/projects/${projectId}`);
  if (!projRes.ok) return c.json({ error: "Project not found" }, 404);

  const project = await projRes.json() as { slug: string; api_key: string };

  // Send test notification via webhook
  const webhookRes = await fetch(`${NOTIFY_URL}/api/webhook/${project.slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": project.api_key,
    },
    body: JSON.stringify({
      title: "🧪 Test Notification",
      body: `Test from Cockpit at ${new Date().toLocaleString()}`,
      data: { source: "cockpit-test" },
      priority: "high",
    }),
    signal: AbortSignal.timeout(10000),
  });

  return c.json(await webhookRes.json(), webhookRes.status as any);
});

// ── Send Notification (from cockpit integrations) ──

notifyRoutes.post("/send/:projectSlug", async (c) => {
  const slug = c.req.param("projectSlug");
  const body = await c.req.json();

  // Look up project to get API key
  const projRes = await notifyAdmin("/api/projects");
  if (!projRes.ok) return c.json({ error: "Cannot reach notify service" }, 503);

  const { projects } = await projRes.json() as { projects: Array<{ slug: string; api_key: string }> };
  const project = projects.find((p: any) => p.slug === slug);
  if (!project) return c.json({ error: `Project '${slug}' not found` }, 404);

  const webhookRes = await fetch(`${NOTIFY_URL}/api/webhook/${slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": project.api_key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  return c.json(await webhookRes.json(), webhookRes.status as any);
});
