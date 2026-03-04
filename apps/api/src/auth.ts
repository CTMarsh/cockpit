import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Hono } from "hono";
import { db } from "./db";

const SESSION_DURATION_HOURS = 24;

// ── Rate limiting for login ──
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
};

// Clean expired sessions on startup
stmts.cleanExpired.run();

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  // Rate limiting
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
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
  ];
  if (publicPaths.includes(path) || path.match(/^\/api\/[a-z-]+\/health$/)) {
    return next();
  }

  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = stmts.getSession.get(token);
  if (!session) return c.json({ error: "Session expired" }, 401);

  return next();
}
