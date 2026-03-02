import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Hono } from "hono";
import { db } from "./db";

const SESSION_DURATION_HOURS = 24;

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
  const body = await c.req.json<{ username: string; password: string }>();
  const validUser = process.env.COCKPIT_USER || "admin";
  const validPass = process.env.COCKPIT_PASS || "cockpit";

  if (body.username !== validUser || body.password !== validPass) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = crypto.randomUUID();
  stmts.createSession.run(token, `+${SESSION_DURATION_HOURS} hours`);

  setCookie(c, "cockpit_session", token, {
    httpOnly: true,
    secure: false, // Set true behind HTTPS reverse proxy
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

  // Public routes — no auth needed
  if (
    path === "/api/health" ||
    path === "/api/auth/login" ||
    path === "/api/auth/me" ||
    path === "/api/auth/logout" ||
    path.includes("/health")
  ) {
    return next();
  }

  const token = getCookie(c, "cockpit_session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const session = stmts.getSession.get(token);
  if (!session) return c.json({ error: "Session expired" }, 401);

  return next();
}
