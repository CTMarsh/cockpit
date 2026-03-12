import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { apiReference } from "@scalar/hono-api-reference";
import { authRoutes, authMiddleware, cleanupAuth } from "./auth";
import sql, { migrate } from "./db";
import { redis, redisSub, connectRedis } from "./redis";
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
import { k8sRoutes } from "../../../modules/k8s/api";
import { haRoutes } from "../../../modules/homeassistant/api";
import { backupRoutes } from "../../../modules/backup/api";
import { alertsRoutes } from "../../../modules/alerts/api";
import { deployHistoryRoutes } from "../../../modules/deploy-history/api";
import { minioRoutes } from "../../../modules/minio/api";
import { notifyRoutes } from "../../../modules/notify/api";
import { gitlabRoutes } from "../../../modules/gitlab/api";
import { uptimeRoutes } from "../../../modules/uptime/api";
import { certificateRoutes } from "../../../modules/certificates/api";
import { traefikRoutes } from "../../../modules/traefik/api";
import { dnsRoutes } from "../../../modules/dns/api";
import { networkRoutes } from "../../../modules/network/api";
import { ansibleRoutes } from "../../../modules/ansible/api";

// Run database migrations and connect Redis before serving
await migrate();
await cleanupAuth();
await connectRedis();

const app = new OpenAPIHono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.NODE_ENV === "production"
      ? ["https://dashboard.noahsark.me"]
      : ["http://localhost:3000", "http://localhost:5173", "https://dashboard.noahsark.me"],
    credentials: true,
  })
);

// Auth routes (login/logout/me) — before auth middleware
app.route("/api/auth", authRoutes);

// Auth middleware — protects all routes below
app.use("/api/*", authMiddleware);

// CSRF/Origin validation — reject state-changing requests from unknown origins
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? ['https://dashboard.noahsark.me']
  : ['https://dashboard.noahsark.me', 'http://localhost:3000', 'http://localhost:5173'];

app.use('/api/*', async (c, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
  }
  await next();
});

// Health check
const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  tags: ['System'],
  description: 'API health check',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.string(), name: z.string(), version: z.string(), modules: z.number() }) } },
      description: 'Health status'
    }
  }
});
app.openapi(healthRoute, (c) =>
  c.json({ status: "ok", name: "Cockpit API", version: process.env.APP_VERSION || "unknown", modules: 25 }, 200)
);

// Dashboard stats — aggregated overview
const dashboardStatsRoute = createRoute({
  method: 'get',
  path: '/api/dashboard/stats',
  tags: ['System'],
  description: 'Aggregated dashboard statistics',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({
        bookmarkCount: z.number(),
        docCount: z.number(),
        serviceCount: z.number(),
        recentBookmarks: z.array(z.any()),
        recentDocs: z.array(z.any()),
        cronTotal: z.number(),
        cronEnabled: z.number(),
        cronFailed: z.number(),
        clusterNodes: z.number(),
        clusterOnline: z.number(),
      }) } },
      description: 'Dashboard statistics'
    }
  }
});
app.openapi(dashboardStatsRoute, async (c) => {
  const [{ count: bookmarkCount }] = await sql`SELECT COUNT(*)::int as count FROM bookmarks`;
  const [{ count: docCount }] = await sql`SELECT COUNT(*)::int as count FROM documents`;
  const [{ count: serviceCount }] = await sql`SELECT COUNT(*)::int as count FROM services`;
  const recentBookmarks = await sql`SELECT id, url, title, tags, created_at FROM bookmarks ORDER BY created_at DESC LIMIT 5`;
  const recentDocs = await sql`SELECT id, title, updated_at FROM documents ORDER BY updated_at DESC LIMIT 5`;

  // Cron stats
  const [{ count: cronTotal }] = await sql`SELECT COUNT(*)::int as count FROM cron_jobs`;
  const [{ count: cronEnabled }] = await sql`SELECT COUNT(*)::int as count FROM cron_jobs WHERE enabled = 1`;
  const [{ count: cronFailed }] = await sql`
    SELECT COUNT(DISTINCT j.id)::int as count FROM cron_jobs j
    INNER JOIN cron_runs r ON r.job_id = j.id
    WHERE r.exit_code != 0 AND r.id = (SELECT MAX(r2.id) FROM cron_runs r2 WHERE r2.job_id = j.id)
  `;

  // Cluster health (best-effort, 3s timeout)
  let clusterNodes = 0;
  let clusterOnline = 0;
  try {
    const proxmoxUrl = process.env.PROXMOX_URL;
    const proxmoxToken = process.env.PROXMOX_TOKEN;
    if (proxmoxUrl && proxmoxToken) {
      const res = await fetch(`${proxmoxUrl}/api2/json/nodes`, {
        headers: { Authorization: `PVEAPIToken=${proxmoxToken}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const nodes = data.data || [];
        clusterNodes = nodes.length;
        clusterOnline = nodes.filter((n: any) => n.status === "online").length;
      }
    }
  } catch {
    // Proxmox unreachable — graceful fallback
  }

  return c.json({
    bookmarkCount, docCount, serviceCount, recentBookmarks, recentDocs,
    cronTotal, cronEnabled, cronFailed,
    clusterNodes, clusterOnline,
  } as any, 200);
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
app.route("/api/k8s", k8sRoutes);
app.route("/api/ha", haRoutes);
app.route("/api/backup", backupRoutes);
app.route("/api/alerts", alertsRoutes);
app.route("/api/deploy-history", deployHistoryRoutes);
app.route("/api/minio", minioRoutes);
app.route("/api/notify", notifyRoutes);
app.route("/api/gitlab", gitlabRoutes);
app.route("/api/uptime", uptimeRoutes);
app.route("/api/certificates", certificateRoutes);
app.route("/api/traefik", traefikRoutes);
app.route("/api/dns", dnsRoutes);
app.route("/api/network", networkRoutes);
app.route("/api/ansible", ansibleRoutes);

// OpenAPI documentation
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Cockpit API',
    version: process.env.APP_VERSION || 'unknown',
    description: 'NoahsArk Cockpit - Homelab Dashboard API. All endpoints require session authentication via cockpit_session cookie unless noted otherwise.'
  },
  servers: [{ url: '/api', description: 'API Server' }],
  security: [{ sessionAuth: [] }],
  components: {
    securitySchemes: {
      sessionAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'cockpit_session',
        description: 'Session cookie obtained via POST /api/auth/login'
      }
    }
  }
} as any);

app.get('/api/docs', apiReference({
  spec: { url: '/api/openapi.json' },
  theme: 'kepler',
  layout: 'modern',
  darkMode: true,
} as any));

// WebSocket endpoint for markdown collaboration — Redis pub/sub for cross-pod support
const localWsClients = new Map<string, Set<any>>();

// Subscribe to Redis for cross-pod WebSocket messages
try {
  redisSub.subscribe("ws:markdown", (err) => {
    if (err) console.warn("Redis subscribe failed:", err.message);
  });
  redisSub.on("message", (_channel: string, message: string) => {
    try {
      const { docId, content, senderId } = JSON.parse(message);
      const clients = localWsClients.get(docId);
      if (clients) {
        for (const client of clients) {
          // Don't echo back to sender on this pod
          if (client.data?.senderId !== senderId) {
            client.send(JSON.stringify({ type: "update", content, docId }));
          }
        }
      }
    } catch { /* ignore malformed */ }
  });
} catch {
  console.warn("Redis pub/sub not available, WebSocket will be local-only");
}

const port = Number(process.env.API_PORT) || 4000;
console.log(`🚀 Cockpit API running on http://localhost:${port}`);

export default {
  port,
  async fetch(req: Request, server: any) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ws") {
      // Authenticate WebSocket connections via session cookie
      const cookies = req.headers.get("cookie") || "";
      const sessionMatch = cookies.match(/cockpit_session=([^;]+)/);
      const token = sessionMatch?.[1];
      if (!token) return new Response("Unauthorized", { status: 401 });
      const [session] = await sql`SELECT token FROM sessions WHERE token = ${token} AND expires_at > NOW()`;
      if (!session) return new Response("Unauthorized", { status: 401 });

      const docId = url.searchParams.get("docId") || "default";
      const senderId = crypto.randomUUID();
      if (server.upgrade(req, { data: { docId, senderId } })) return;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return app.fetch(req, server);
  },
  websocket: {
    open(ws: any) {
      const docId = ws.data?.docId || "default";
      if (!localWsClients.has(docId)) localWsClients.set(docId, new Set());
      localWsClients.get(docId)!.add(ws);
    },
    message(ws: any, message: string) {
      try {
        const data = JSON.parse(message);
        const docId = ws.data?.docId || "default";
        const senderId = ws.data?.senderId;

        // Broadcast to local clients on this pod
        const clients = localWsClients.get(docId);
        if (clients) {
          for (const client of clients) {
            if (client !== ws) {
              client.send(JSON.stringify({ type: "update", content: data.content, docId }));
            }
          }
        }

        // Publish to Redis for other pods
        try {
          redis.publish("ws:markdown", JSON.stringify({ docId, content: data.content, senderId }));
        } catch { /* Redis unavailable — local-only mode */ }
      } catch {
        // ignore malformed messages
      }
    },
    close(ws: any) {
      for (const [, clients] of localWsClients) {
        clients.delete(ws);
      }
    },
  },
};
