import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes, authMiddleware } from "./auth";
import { homelabRoutes } from "../../../modules/homelab/api";
import { bookmarksRoutes } from "../../../modules/bookmarks/api";
import { dedupRoutes } from "../../../modules/dedup/api";
import { randomizerRoutes } from "../../../modules/randomizer/api";
import { markdownRoutes } from "../../../modules/markdown/api";
import { graphRoutes } from "../../../modules/graph/api";

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
  c.json({ status: "ok", name: "Cockpit API", modules: 6 })
);

// Module routes — each has its own namespace
app.route("/api/homelab", homelabRoutes);
app.route("/api/bookmarks", bookmarksRoutes);
app.route("/api/dedup", dedupRoutes);
app.route("/api/randomizer", randomizerRoutes);
app.route("/api/markdown", markdownRoutes);
app.route("/api/graph", graphRoutes);

// WebSocket endpoint for markdown collaboration
const wsClients = new Map<string, Set<any>>();

const port = Number(process.env.API_PORT) || 4000;
console.log(`🚀 Cockpit API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
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
