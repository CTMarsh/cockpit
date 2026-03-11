import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "./db";

const SESSION_DURATION_HOURS = 24;

// ── Rate limiting for login ──
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Periodically clean expired rate-limit entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 60000);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_LOGIN_ATTEMPTS;
}

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do constant-time work to avoid length-based timing leak
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

const stmts = {
  createSession: db.query("INSERT INTO sessions (token, expires_at) VALUES (?, datetime('now', ?))"),
  getSession: db.query("SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"),
  deleteSession: db.query("DELETE FROM sessions WHERE token = ?"),
  cleanExpired: db.query("DELETE FROM sessions WHERE expires_at <= datetime('now')"),
  // Device code flow (watch/TV login)
  createDeviceCode: db.query("INSERT INTO device_codes (code, expires_at) VALUES (?, datetime('now', '+5 minutes'))"),
  getDeviceCode: db.query<{ code: string; status: string; session_token: string | null; expires_at: string }, [string]>(
    "SELECT * FROM device_codes WHERE code = ? AND expires_at > datetime('now')"
  ),
  approveDeviceCode: db.query("UPDATE device_codes SET status = 'approved', session_token = ? WHERE code = ? AND status = 'pending' AND expires_at > datetime('now')"),
  cleanExpiredCodes: db.query("DELETE FROM device_codes WHERE expires_at <= datetime('now')"),
};

// Clean expired sessions and device codes on startup
stmts.cleanExpired.run();
stmts.cleanExpiredCodes.run();

// Startup warnings for default credentials
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
  // Rate limiting — use last entry of X-Forwarded-For (closest proxy) to prevent spoofing
  const xff = c.req.header("x-forwarded-for");
  const ip = xff ? xff.split(",").pop()?.trim() || "unknown" : c.req.header("x-real-ip") || "unknown";
  if (!checkRateLimit(ip)) {
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
  stmts.createSession.run(token, `+${SESSION_DURATION_HOURS} hours`);

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
authRoutes.openapi(logoutRoute, (c) => {
  const token = getCookie(c, "cockpit_session");
  if (token) stmts.deleteSession.run(token);
  deleteCookie(c, "cockpit_session", { path: "/" });
  return c.json({ ok: true }, 200);
});

// ── Device Code Flow (QR-based watch/device login) ──

// Step 1: Device requests a code (no auth needed)
const deviceCodeRoute = createRoute({
  method: 'post',
  path: '/device-code',
  tags: ['Auth'],
  description: 'Request a device login code (QR-based)',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ code: z.string(), expires_in: z.number() }) } }, description: 'Device code generated' },
  }
});
authRoutes.openapi(deviceCodeRoute, (c) => {
  // Generate a 6-character alphanumeric code (easy to read on small screens)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += chars[b % chars.length];

  stmts.createDeviceCode.run(code);
  return c.json({ code, expires_in: 300 }, 200);
});

// Step 2: Device polls for approval (no auth needed)
const pollDeviceCodeRoute = createRoute({
  method: 'get',
  path: '/device-code/{code}',
  tags: ['Auth'],
  description: 'Poll device code approval status',
  request: {
    params: z.object({ code: z.string() })
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ status: z.string() }) } }, description: 'Code status' },
  }
});
authRoutes.openapi(pollDeviceCodeRoute, (c) => {
  const code = c.req.valid('param').code.toUpperCase();
  const row = stmts.getDeviceCode.get(code);

  if (!row) return c.json({ status: "expired" }, 200);

  if (row.status === "approved" && row.session_token) {
    // Set the session cookie on the polling device
    setCookie(c, "cockpit_session", row.session_token, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: SESSION_DURATION_HOURS * 3600,
      path: "/",
    });
    // Clean up the used code
    db.run("DELETE FROM device_codes WHERE code = ?", [code]);
    return c.json({ status: "approved" }, 200);
  }

  return c.json({ status: "pending" }, 200);
});

// Step 3: Authenticated user approves a code (requires auth — will go through middleware)
// This is mounted separately below authMiddleware in index.ts
const approveDeviceCodeRoute = createRoute({
  method: 'post',
  path: '/device-code/{code}/approve',
  tags: ['Auth'],
  description: 'Approve a device login code (requires auth)',
  request: {
    params: z.object({ code: z.string() })
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Code approved' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Code expired or invalid' },
    409: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Code already used' },
  }
});
authRoutes.openapi(approveDeviceCodeRoute, (c) => {
  const code = c.req.valid('param').code.toUpperCase();
  const row = stmts.getDeviceCode.get(code);

  if (!row) return c.json({ error: "Code expired or invalid" } as any, 404);
  if (row.status !== "pending") return c.json({ error: "Code already used" } as any, 409);

  // Create a new session for the device
  const token = crypto.randomUUID();
  stmts.createSession.run(token, `+${SESSION_DURATION_HOURS} hours`);
  stmts.approveDeviceCode.run(token, code);

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
authRoutes.openapi(meRoute, (c) => {
  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ authenticated: false } as any, 401);
  const session = stmts.getSession.get(token);
  if (!session) return c.json({ authenticated: false } as any, 401);
  return c.json({ authenticated: true, user: process.env.COCKPIT_USER || "admin" }, 200);
});

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  // Public routes — no auth needed (exact match only to prevent bypass)
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

  const session = stmts.getSession.get(token);
  if (!session) return c.json({ error: "Session expired" }, 401);

  return next();
}
