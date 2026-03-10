import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Hono } from "hono";
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

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  // Rate limiting — use last entry of X-Forwarded-For (closest proxy) to prevent spoofing
  const xff = c.req.header("x-forwarded-for");
  const ip = xff ? xff.split(",").pop()?.trim() || "unknown" : c.req.header("x-real-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return c.json({ error: "Too many login attempts. Try again later." }, 429);
  }

  const body = await c.req.json<{ username: string; password: string }>();
  const validUser = process.env.COCKPIT_USER || "admin";
  const validPass = process.env.COCKPIT_PASS || "cockpit";

  const userMatch = safeCompare(body.username || "", validUser);
  const passMatch = safeCompare(body.password || "", validPass);

  if (!userMatch || !passMatch) {
    return c.json({ error: "Invalid credentials" }, 401);
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

  return c.json({ ok: true });
});

authRoutes.post("/logout", (c) => {
  const token = getCookie(c, "cockpit_session");
  if (token) stmts.deleteSession.run(token);
  deleteCookie(c, "cockpit_session", { path: "/" });
  return c.json({ ok: true });
});

// ── Device Code Flow (QR-based watch/device login) ──

// Step 1: Device requests a code (no auth needed)
authRoutes.post("/device-code", (c) => {
  // Generate a 6-character alphanumeric code (easy to read on small screens)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) code += chars[b % chars.length];

  stmts.createDeviceCode.run(code);
  return c.json({ code, expires_in: 300 });
});

// Step 2: Device polls for approval (no auth needed)
authRoutes.get("/device-code/:code", (c) => {
  const code = c.req.param("code").toUpperCase();
  const row = stmts.getDeviceCode.get(code);

  if (!row) return c.json({ status: "expired" });

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
    return c.json({ status: "approved" });
  }

  return c.json({ status: "pending" });
});

// Step 3: Authenticated user approves a code (requires auth — will go through middleware)
// This is mounted separately below authMiddleware in index.ts
authRoutes.post("/device-code/:code/approve", (c) => {
  const code = c.req.param("code").toUpperCase();
  const row = stmts.getDeviceCode.get(code);

  if (!row) return c.json({ error: "Code expired or invalid" }, 404);
  if (row.status !== "pending") return c.json({ error: "Code already used" }, 409);

  // Create a new session for the device
  const token = crypto.randomUUID();
  stmts.createSession.run(token, `+${SESSION_DURATION_HOURS} hours`);
  stmts.approveDeviceCode.run(token, code);

  return c.json({ ok: true });
});

authRoutes.get("/me", (c) => {
  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ authenticated: false }, 401);
  const session = stmts.getSession.get(token);
  if (!session) return c.json({ authenticated: false }, 401);
  return c.json({ authenticated: true, user: process.env.COCKPIT_USER || "admin" });
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
