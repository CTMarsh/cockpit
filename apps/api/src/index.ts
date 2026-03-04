import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes, authMiddleware } from "./auth";
import { db } from "./db";
import { homelabRoutes } from "../../../modules/homelab/api";
import { bookmarksRoutes } from "../../../modules/bookmarks/api";
import { dedupRoutes } from "../../../modules/dedup/api";
import { randomizerRoutes } from "../../../modules/randomizer/api";
import { markdownRoutes } from "../../../modules/markdown/api";
import { graphRoutes } from "../../../modules/graph/api";
import { sysmonRoutes } from "../../../modules/sysmon/api";
import { proxmoxRoutes } from "../../../modules/proxmox/api";
import { logsRoutes } from "../../../modules/logs/api";
import { cronRoutes } from "../../../modules/cron/api";
import { wolRoutes } from "../../../modules/wol/api";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "https://dashboard.noahsark.me"],
    credentials: true,
  })
);

// Auth routes (login/logout/me) — before auth middleware
app.route("/api/auth", authRoutes);

// Auth middleware — protects all routes below
app.use("/api/*", authMiddleware);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", name: "Cockpit API", version: process.env.APP_VERSION || "unknown", modules: 11 })
);

// Dashboard stats — aggregated overview
app.get("/api/dashboard/stats", async (c) => {
  const bookmarkCount = (db.query("SELECT COUNT(*) as count FROM bookmarks").get() as any)?.count || 0;
  const docCount = (db.query("SELECT COUNT(*) as count FROM documents").get() as any)?.count || 0;
  const serviceCount = (db.query("SELECT COUNT(*) as count FROM services").get() as any)?.count || 0;
  const recentBookmarks = db.query("SELECT id, url, title, tags, created_at FROM bookmarks ORDER BY created_at DESC LIMIT 5").all();
  const recentDocs = db.query("SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC LIMIT 5").all();
  return c.json({ bookmarkCount, docCount, serviceCount, recentBookmarks, recentDocs });
});

// Module routes — each has its own namespace
app.route("/api/homelab", homelabRoutes);
app.route("/api/bookmarks", bookmarksRoutes);
app.route("/api/dedup", dedupRoutes);
app.route("/api/randomizer", randomizerRoutes);
app.route("/api/markdown", markdownRoutes);
app.route("/api/graph", graphRoutes);
app.route("/api/sysmon", sysmonRoutes);
app.route("/api/proxmox", proxmoxRoutes);
app.route("/api/logs", logsRoutes);
app.route("/api/cron", cronRoutes);
app.route("/api/wol", wolRoutes);

// WebSocket endpoint for markdown collaboration
const wsClients = new Map<string, Set<any>>();

const port = Number(process.env.API_PORT) || 4000;
console.log(`🚀 Cockpit API running on http://localhost:${port}`);

export default {
  port,
  fetch(req: Request, server: any) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ws") {
      const docId = url.searchParams.get("docId") || "default";
      if (server.upgrade(req, { data: { docId } })) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req, server);
  },
  websocket: {
    open(ws: any) {
      const docId = ws.data?.docId || "default";
      if (!wsClients.has(docId)) wsClients.set(docId, new Set());
      wsClients.get(docId)!.add(ws);
    },
    message(ws: any, message: string) {
      try {
        const data = JSON.parse(message);
        const docId = data.docId || ws.data?.docId || "default";
        const clients = wsClients.get(docId);
        if (clients) {
          for (const client of clients) {
            if (client !== ws) {
              client.send(JSON.stringify({ type: "update", content: data.content, docId }));
            }
          }
        }
      } catch {
        // ignore malformed messages
      }
    },
    close(ws: any) {
      for (const [, clients] of wsClients) {
        clients.delete(ws);
      }
    },
  },
};
