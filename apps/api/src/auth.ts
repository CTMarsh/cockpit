import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "./db";

const SESSION_DURATION_HOURS = 24;

// ── Rate limiting for login (database-backed for HA) ──
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(ip: string): Promise<boolean> {
  const now = new Date();
  await sql`DELETE FROM rate_limits WHERE reset_at <= ${now}`;
  const [entry] = await sql`SELECT count, reset_at FROM rate_limits WHERE ip = ${ip}`;
  if (!entry) {
    const resetAt = new Date(now.getTime() + LOGIN_WINDOW_MS);
    await sql`INSERT INTO rate_limits (ip, count, reset_at) VALUES (${ip}, 1, ${resetAt})`;
    return true;
  }
  await sql`UPDATE rate_limits SET count = count + 1 WHERE ip = ${ip}`;
  return (entry.count as number) + 1 <= MAX_LOGIN_ATTEMPTS;
}

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let result = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Clean expired sessions and device codes on startup
async function cleanupAuth() {
  await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
  await sql`DELETE FROM device_codes WHERE expires_at <= NOW()`;
}

if (!process.env.COCKPIT_PASS) {
  console.warn("WARNING: COCKPIT_PASS not set, using default credentials. Set COCKPIT_PASS in production!");
}
if (!process.env.COCKPIT_USER) {
  console.warn("WARNING: COCKPIT_USER not set, using default 'admin'. Set COCKPIT_USER in production!");
}

export const authRoutes = new OpenAPIHono();

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  description: 'Login with username and password',
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ username: z.string(), password: z.string() }) } }
    }
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Login successful' },
    401: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Invalid credentials' },
    429: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Rate limited' },
  }
});
authRoutes.openapi(loginRoute, async (c) => {
  const xff = c.req.header("x-forwarded-for");
  const ip = xff ? xff.split(",").pop()?.trim() || "unknown" : c.req.header("x-real-ip") || "unknown";
  if (!(await checkRateLimit(ip))) {
    return c.json({ error: "Too many login attempts. Try again later." } as any, 429);
  }

  const body = c.req.valid('json');
  const validUser = process.env.COCKPIT_USER || "admin";
  const validPass = process.env.COCKPIT_PASS || "cockpit";

  const userMatch = safeCompare(body.username || "", validUser);
  const passMatch = safeCompare(body.password || "", validPass);

  if (!userMatch || !passMatch) {
    return c.json({ error: "Invalid credentials" } as any, 401);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000);
  await sql`INSERT INTO sessions (token, expires_at) VALUES (${token}, ${expiresAt})`;

  setCookie(c, "cockpit_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_DURATION_HOURS * 3600,
    path: "/",
  });

  return c.json({ ok: true }, 200);
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  description: 'Logout and destroy session',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Logout successful' },
  }
});
authRoutes.openapi(logoutRoute, async (c) => {
  const token = getCookie(c, "cockpit_session");
  if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
  deleteCookie(c, "cockpit_session", { path: "/" });
  return c.json({ ok: true }, 200);
});

const deviceCodeRoute = createRoute({
  method: 'post',
  path: '/device-code',
  tags: ['Auth'],
  description: 'Request a device login code (QR-based)',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ code: z.string(), expires_in: z.number() }) } }, description: 'Device code generated' },
  }
});
authRoutes.openapi(deviceCodeRoute, async (c) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += chars[b % chars.length];

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await sql`INSERT INTO device_codes (code, expires_at) VALUES (${code}, ${expiresAt})`;
  return c.json({ code, expires_in: 300 }, 200);
});

const pollDeviceCodeRoute = createRoute({
  method: 'get',
  path: '/device-code/{code}',
  tags: ['Auth'],
  description: 'Poll device code approval status',
  request: { params: z.object({ code: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ status: z.string() }) } }, description: 'Code status' },
  }
});
authRoutes.openapi(pollDeviceCodeRoute, async (c) => {
  const code = c.req.valid('param').code.toUpperCase();
  const [row] = await sql`SELECT code, status, session_token, expires_at FROM device_codes WHERE code = ${code} AND expires_at > NOW()`;

  if (!row) return c.json({ status: "expired" }, 200);

  if (row.status === "approved" && row.session_token) {
    setCookie(c, "cockpit_session", row.session_token as string, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: SESSION_DURATION_HOURS * 3600,
      path: "/",
    });
    await sql`DELETE FROM device_codes WHERE code = ${code}`;
    return c.json({ status: "approved" }, 200);
  }

  return c.json({ status: "pending" }, 200);
});

const approveDeviceCodeRoute = createRoute({
  method: 'post',
  path: '/device-code/{code}/approve',
  tags: ['Auth'],
  description: 'Approve a device login code (requires auth)',
  request: { params: z.object({ code: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Code approved' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Code expired or invalid' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Code already used' },
  }
});
authRoutes.openapi(approveDeviceCodeRoute, async (c) => {
  const code = c.req.valid('param').code.toUpperCase();
  const [row] = await sql`SELECT code, status FROM device_codes WHERE code = ${code} AND expires_at > NOW()`;

  if (!row) return c.json({ error: "Code expired or invalid" } as any, 404);
  if (row.status !== "pending") return c.json({ error: "Code already used" } as any, 409);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 3600 * 1000);
  await sql`INSERT INTO sessions (token, expires_at) VALUES (${token}, ${expiresAt})`;
  await sql`UPDATE device_codes SET status = 'approved', session_token = ${token} WHERE code = ${code} AND status = 'pending'`;

  return c.json({ ok: true }, 200);
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Auth'],
  description: 'Get current authenticated user',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ authenticated: z.boolean(), user: z.string().optional() }) } }, description: 'User info' },
    401: { content: { 'application/json': { schema: z.object({ authenticated: z.boolean() }) } }, description: 'Not authenticated' },
  }
});
authRoutes.openapi(meRoute, async (c) => {
  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ authenticated: false } as any, 401);
  const [session] = await sql`SELECT token FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
  if (!session) return c.json({ authenticated: false } as any, 401);
  return c.json({ authenticated: true, user: process.env.COCKPIT_USER || "admin" }, 200);
});

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  const publicPaths = [
    "/api/health",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
    "/api/auth/device-code",
  ];
  if (publicPaths.includes(path) || path.match(/^\/api\/[a-z-]+\/health$/) || path.match(/^\/api\/auth\/device-code\/[A-Z0-9]+$/)) {
    return next();
  }

  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const [session] = await sql`SELECT token FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
  if (!session) return c.json({ error: "Session expired" }, 401);

  return next();
}

export { cleanupAuth };
