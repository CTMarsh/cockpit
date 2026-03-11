import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const haRoutes = new OpenAPIHono();

const HA_URL = process.env.HA_URL || "";
const HA_TOKEN = process.env.HA_TOKEN || "";

function haAvailable(): boolean { return !!(HA_URL && HA_TOKEN); }

async function haFetch(path: string, method = "GET", body?: any): Promise<any> {
  if (!haAvailable()) return null;
  try {
    const res = await fetch(`${HA_URL}${path}`, {
      method, headers: { Authorization: `Bearer ${HA_TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Home Assistant'],
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Module health' } }
});
haRoutes.openapi(healthRoute, async (c) => {
  if (!haAvailable()) return c.json({ available: false, message: "HA_URL and HA_TOKEN not configured" }, 200);
  const data = await haFetch("/api/");
  return c.json({ available: !!data, message: data ? "Connected to Home Assistant" : "Cannot reach Home Assistant" }, 200);
});

const statesRoute = createRoute({
  method: 'get', path: '/states', tags: ['Home Assistant'],
  description: 'List all entity states',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Entity states' } }
});
haRoutes.openapi(statesRoute, async (c) => {
  if (!haAvailable()) return c.json({ available: false, entities: [] }, 200);
  const data = await haFetch("/api/states");
  if (!data) return c.json({ available: false, entities: [], message: "Cannot reach Home Assistant" }, 200);
  const entities = (data as any[]).map((e) => ({
    entity_id: e.entity_id, state: e.state, domain: e.entity_id.split(".")[0],
    friendly_name: e.attributes?.friendly_name || e.entity_id, icon: e.attributes?.icon || null,
    unit: e.attributes?.unit_of_measurement || null, device_class: e.attributes?.device_class || null,
    last_changed: e.last_changed, last_updated: e.last_updated, attributes: e.attributes || {},
  }));
  return c.json({ available: true, entities } as any, 200);
});

const servicesRoute = createRoute({
  method: 'get', path: '/services', tags: ['Home Assistant'],
  description: 'List available service domains',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Service domains' } }
});
haRoutes.openapi(servicesRoute, async (c) => {
  if (!haAvailable()) return c.json({ available: false, services: [] }, 200);
  const data = await haFetch("/api/services");
  if (!data) return c.json({ available: false, services: [] }, 200);
  return c.json({ available: true, services: data }, 200);
});

const callServiceRoute = createRoute({
  method: 'post', path: '/services/{domain}/{service}', tags: ['Home Assistant'],
  description: 'Call a Home Assistant service',
  request: { params: z.object({ domain: z.string(), service: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Service result' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Upstream error' },
    503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'HA not configured' },
  }
});
haRoutes.openapi(callServiceRoute, async (c) => {
  if (!haAvailable()) return c.json({ error: "Home Assistant not configured" } as any, 503);
  const { domain, service } = c.req.valid('param');
  if (!/^[a-z0-9_]+$/.test(domain) || !/^[a-z0-9_]+$/.test(service)) return c.json({ error: "Invalid domain or service name" } as any, 400);
  const body = await c.req.json().catch(() => ({}));
  const result = await haFetch(`/api/services/${domain}/${service}`, "POST", body);
  if (result === null) return c.json({ error: "Failed to call service" } as any, 502);
  return c.json({ ok: true, result }, 200);
});

const historyRoute = createRoute({
  method: 'get', path: '/history', tags: ['Home Assistant'],
  description: 'Entity history for charts',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Entity history' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
haRoutes.openapi(historyRoute, async (c) => {
  if (!haAvailable()) return c.json({ available: false, history: [] }, 200);
  const entityId = c.req.query("entity_id");
  const hours = Number(c.req.query("hours")) || 24;
  if (!entityId) return c.json({ error: "entity_id required" } as any, 400);
  if (!/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) return c.json({ error: "Invalid entity_id format" } as any, 400);
  const end = new Date();
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  const path = `/api/history/period/${start.toISOString()}?filter_entity_id=${encodeURIComponent(entityId)}&end_time=${end.toISOString()}&minimal_response`;
  const data = await haFetch(path);
  if (!data || !Array.isArray(data) || data.length === 0) return c.json({ available: true, history: [] }, 200);
  return c.json({ available: true, history: data[0] }, 200);
});

// SSE events/stream — kept as regular Hono route
haRoutes.get("/events/stream", async (c) => {
  if (!haAvailable()) return c.json({ error: "Home Assistant not configured" }, 503);
  const domainFilter = c.req.query("domain") || "";
  const stream = new ReadableStream({
    start(controller) {
      const wsUrl = HA_URL.replace(/^http/, "ws") + "/api/websocket";
      let ws: WebSocket | null = null;
      let alive = true;
      function connect() {
        if (!alive) return;
        try { ws = new WebSocket(wsUrl); } catch { setTimeout(connect, 5000); return; }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "auth_required") { ws!.send(JSON.stringify({ type: "auth", access_token: HA_TOKEN })); return; }
            if (msg.type === "auth_ok") { ws!.send(JSON.stringify({ id: 1, type: "subscribe_events", event_type: "state_changed" })); return; }
            if (msg.type === "auth_invalid") { controller.enqueue(`data: ${JSON.stringify({ type: "error", message: "Invalid HA token" })}\n\n`); controller.close(); alive = false; return; }
            if (msg.type === "event" && msg.event?.event_type === "state_changed") {
              const data = msg.event.data;
              const entityDomain = data.entity_id?.split(".")[0] || "";
              if (domainFilter && entityDomain !== domainFilter) return;
              const payload = { type: "state_changed", entity_id: data.entity_id, new_state: data.new_state ? { state: data.new_state.state, friendly_name: data.new_state.attributes?.friendly_name, last_changed: data.new_state.last_changed, attributes: data.new_state.attributes } : null, old_state: data.old_state ? { state: data.old_state.state } : null };
              controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
            }
          } catch { /* Ignore malformed messages */ }
        };
        ws.onerror = () => { ws?.close(); };
        ws.onclose = () => { if (alive) setTimeout(connect, 5000); };
      }
      connect();
      const heartbeat = setInterval(() => { if (!alive) { clearInterval(heartbeat); return; } controller.enqueue(`: heartbeat\n\n`); }, 30000);
      c.req.raw.signal.addEventListener("abort", () => { alive = false; clearInterval(heartbeat); ws?.close(); try { controller.close(); } catch { /* already closed */ } });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
});
