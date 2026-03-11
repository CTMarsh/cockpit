import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const dnsRoutes = new OpenAPIHono();

const CF_API = "https://api.cloudflare.com/client/v4";
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

async function cfFetch(path: string, method = "GET", body?: any): Promise<any> {
  const token = process.env.CLOUDFLARE_API_TOKEN; const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;
  const url = path.startsWith("/zones") ? `${CF_API}${path}` : `${CF_API}/zones/${zoneId}${path}`;
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

function validateRecord(body: { content?: string; proxied?: boolean }): string | null {
  if (body.proxied && body.content && PRIVATE_IP_RE.test(body.content)) return "Cannot proxy internal IP addresses";
  return null;
}

const listRecordsRoute = createRoute({ method: 'get', path: '/records', tags: ['DNS'], description: 'List all DNS records', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'DNS records' }, 502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Cloudflare error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not configured' } } });
dnsRoutes.openapi(listRecordsRoute, async (c) => {
  const result = await cfFetch("/dns_records?per_page=100");
  if (!result) return c.json({ error: "Cloudflare not configured" } as any, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" } as any, 502);
  return c.json({ records: result.result }, 200);
});

const createRecordRoute = createRoute({ method: 'post', path: '/records', tags: ['DNS'], request: { body: { content: { 'application/json': { schema: z.object({ type: z.string(), name: z.string(), content: z.string(), ttl: z.number().optional(), proxied: z.boolean().optional() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Record created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not configured' } } });
dnsRoutes.openapi(createRecordRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.type || !body.name || !body.content) return c.json({ error: "type, name, and content are required" } as any, 400);
  const safety = validateRecord(body); if (safety) return c.json({ error: safety } as any, 400);
  const result = await cfFetch("/dns_records", "POST", { type: body.type, name: body.name, content: body.content, ttl: body.ttl || 1, proxied: body.proxied ?? false });
  if (!result) return c.json({ error: "Cloudflare not configured" } as any, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" } as any, 400);
  return c.json({ record: result.result }, 200);
});

const updateRecordRoute = createRoute({ method: 'put', path: '/records/{id}', tags: ['DNS'], request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ type: z.string(), name: z.string(), content: z.string(), ttl: z.number().optional(), proxied: z.boolean().optional() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Record updated' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not configured' } } });
dnsRoutes.openapi(updateRecordRoute, async (c) => {
  const id = c.req.valid('param').id; const body = c.req.valid('json');
  if (!body.type || !body.name || !body.content) return c.json({ error: "type, name, and content are required" } as any, 400);
  const safety = validateRecord(body); if (safety) return c.json({ error: safety } as any, 400);
  const result = await cfFetch(`/dns_records/${id}`, "PUT", { type: body.type, name: body.name, content: body.content, ttl: body.ttl || 1, proxied: body.proxied ?? false });
  if (!result) return c.json({ error: "Cloudflare not configured" } as any, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" } as any, 400);
  return c.json({ record: result.result }, 200);
});

const deleteRecordRoute = createRoute({ method: 'delete', path: '/records/{id}', tags: ['DNS'], request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Deleted' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not configured' } } });
dnsRoutes.openapi(deleteRecordRoute, async (c) => {
  const id = c.req.valid('param').id;
  const result = await cfFetch(`/dns_records/${id}`, "DELETE");
  if (!result) return c.json({ error: "Cloudflare not configured" } as any, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" } as any, 400);
  return c.json({ ok: true }, 200);
});

const zoneRoute = createRoute({ method: 'get', path: '/zone', tags: ['DNS'], description: 'Get zone details', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Zone details' }, 502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not configured' } } });
dnsRoutes.openapi(zoneRoute, async (c) => {
  const result = await cfFetch("/"); if (!result) return c.json({ error: "Cloudflare not configured" } as any, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" } as any, 502);
  return c.json({ zone: result.result }, 200);
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['DNS'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Module health' } } });
dnsRoutes.openapi(healthRoute, (c) => {
  const configured = !!(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
  return c.json({ module: "dns", status: configured ? "ok" : "not_configured", configured }, 200);
});
