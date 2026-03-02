import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
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
    origin: ["http://localhost:3000", "http://localhost:5173"],
  })
);

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

const port = Number(process.env.API_PORT) || 4000;
console.log(`🚀 Cockpit API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
