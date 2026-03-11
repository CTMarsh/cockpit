import { Hono } from "hono";

export const dnsRoutes = new Hono();

const CF_API = "https://api.cloudflare.com/client/v4";

// RFC 1918 private IP regex
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

async function cfFetch(path: string, method = "GET", body?: any): Promise<any> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) return null;

  const url = path.startsWith("/zones")
    ? `${CF_API}${path}`
    : `${CF_API}/zones/${zoneId}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Safety check: reject proxied records pointing at private IPs
function validateRecord(body: { content?: string; proxied?: boolean }): string | null {
  if (body.proxied && body.content && PRIVATE_IP_RE.test(body.content)) {
    return "Cannot proxy internal IP addresses";
  }
  return null;
}

// GET /api/dns/records — list all DNS records
dnsRoutes.get("/records", async (c) => {
  const result = await cfFetch("/dns_records?per_page=100");
  if (!result) return c.json({ error: "Cloudflare not configured" }, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" }, 502);
  return c.json({ records: result.result });
});

// POST /api/dns/records — create a DNS record
dnsRoutes.post("/records", async (c) => {
  const body = await c.req.json<{
    type: string;
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  }>();

  if (!body.type || !body.name || !body.content) {
    return c.json({ error: "type, name, and content are required" }, 400);
  }

  const safety = validateRecord(body);
  if (safety) return c.json({ error: safety }, 400);

  const result = await cfFetch("/dns_records", "POST", {
    type: body.type,
    name: body.name,
    content: body.content,
    ttl: body.ttl || 1,
    proxied: body.proxied ?? false,
  });
  if (!result) return c.json({ error: "Cloudflare not configured" }, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" }, 400);
  return c.json({ record: result.result });
});

// PUT /api/dns/records/:id — update a DNS record
dnsRoutes.put("/records/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    type: string;
    name: string;
    content: string;
    ttl?: number;
    proxied?: boolean;
  }>();

  if (!body.type || !body.name || !body.content) {
    return c.json({ error: "type, name, and content are required" }, 400);
  }

  const safety = validateRecord(body);
  if (safety) return c.json({ error: safety }, 400);

  const result = await cfFetch(`/dns_records/${id}`, "PUT", {
    type: body.type,
    name: body.name,
    content: body.content,
    ttl: body.ttl || 1,
    proxied: body.proxied ?? false,
  });
  if (!result) return c.json({ error: "Cloudflare not configured" }, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" }, 400);
  return c.json({ record: result.result });
});

// DELETE /api/dns/records/:id — delete a DNS record
dnsRoutes.delete("/records/:id", async (c) => {
  const id = c.req.param("id");
  const result = await cfFetch(`/dns_records/${id}`, "DELETE");
  if (!result) return c.json({ error: "Cloudflare not configured" }, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" }, 400);
  return c.json({ ok: true });
});

// GET /api/dns/zone — get zone details
dnsRoutes.get("/zone", async (c) => {
  const result = await cfFetch("/");
  if (!result) return c.json({ error: "Cloudflare not configured" }, 503);
  if (!result.success) return c.json({ error: result.errors?.[0]?.message || "Cloudflare API error" }, 502);
  return c.json({ zone: result.result });
});

// GET /api/dns/health — check if Cloudflare credentials are configured
dnsRoutes.get("/health", (c) => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const configured = !!(token && zoneId);
  return c.json({ module: "dns", status: configured ? "ok" : "not_configured", configured });
});
