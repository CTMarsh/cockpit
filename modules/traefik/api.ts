import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { k8sApi } from "../k8s-client";

export const traefikRoutes = new OpenAPIHono();

const ingressRoutesRoute = createRoute({ method: 'get', path: '/ingressroutes', tags: ['Traefik'], description: 'List Traefik IngressRoutes', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'IngressRoute list' } } });
traefikRoutes.openapi(ingressRoutesRoute, async (c) => {
  const data = await k8sApi("/apis/traefik.io/v1alpha1/ingressroutes");
  if (!data?.items) return c.json({ available: false, ingressRoutes: [] }, 200);
  const ingressRoutes = data.items.map((item: any) => {
    const spec = item.spec || {};
    return { name: item.metadata?.name || "", namespace: item.metadata?.namespace || "", entryPoints: spec.entryPoints || [],
      routes: (spec.routes || []).map((r: any) => ({ match: r.match || "", services: (r.services || []).map((s: any) => ({ name: s.name || "", namespace: s.namespace || item.metadata?.namespace || "", port: s.port, kind: s.kind || "Service" })), middlewares: (r.middlewares || []).map((m: any) => ({ name: m.name || "", namespace: m.namespace || item.metadata?.namespace || "" })) })),
      tls: spec.tls ? { certResolver: spec.tls.certResolver || null, domains: spec.tls.domains || [], secretName: spec.tls.secretName || null } : null };
  });
  ingressRoutes.sort((a: any, b: any) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  return c.json({ available: true, ingressRoutes } as any, 200);
});

const middlewaresRoute = createRoute({ method: 'get', path: '/middlewares', tags: ['Traefik'], description: 'List Traefik Middlewares', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Middleware list' } } });
traefikRoutes.openapi(middlewaresRoute, async (c) => {
  const data = await k8sApi("/apis/traefik.io/v1alpha1/middlewares");
  if (!data?.items) return c.json({ available: false, middlewares: [] }, 200);
  const middlewares = data.items.map((item: any) => { const spec = item.spec || {}; const specKeys = Object.keys(spec); const type = specKeys.length > 0 ? specKeys[0] : "unknown"; return { name: item.metadata?.name || "", namespace: item.metadata?.namespace || "", type, config: spec[type] || {} }; });
  middlewares.sort((a: any, b: any) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  return c.json({ available: true, middlewares } as any, 200);
});

const entrypointsRoute = createRoute({ method: 'get', path: '/entrypoints', tags: ['Traefik'], description: 'Traefik entrypoints', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Entrypoints' } } });
traefikRoutes.openapi(entrypointsRoute, async (c) => {
  try {
    const res = await fetch("http://traefik.traefik.svc:9000/api/entrypoints"); if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json(); const items = Array.isArray(raw) ? raw : Object.values(raw);
    const entrypoints = items.map((ep: any) => ({ name: ep.name || "", address: ep.address || "", protocol: ep.protocol || (ep.address?.includes(":443") ? "HTTPS" : "HTTP") }));
    return c.json({ available: true, entrypoints }, 200);
  } catch { return c.json({ available: false, entrypoints: [{ name: "web", address: ":80", protocol: "HTTP" }, { name: "websecure", address: ":443", protocol: "HTTPS" }, { name: "traefik", address: ":9000", protocol: "HTTP" }] }, 200); }
});

const overviewRoute = createRoute({ method: 'get', path: '/overview', tags: ['Traefik'], description: 'Traefik dashboard overview', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Overview stats' } } });
traefikRoutes.openapi(overviewRoute, async (c) => {
  try { const res = await fetch("http://traefik.traefik.svc:9000/api/overview"); if (!res.ok) throw new Error(`HTTP ${res.status}`); return c.json({ available: true, overview: await res.json() }, 200); }
  catch { return c.json({ available: false, overview: null }, 200); }
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Traefik'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
traefikRoutes.openapi(healthRoute, (c) => c.json({ module: "traefik", status: "ok" }, 200));
