import { Hono } from "hono";
import { k8sApi } from "../k8s-client";

export const traefikRoutes = new Hono();

// ── GET /ingressroutes — list all Traefik IngressRoutes ──
traefikRoutes.get("/ingressroutes", async (c) => {
  const data = await k8sApi("/apis/traefik.io/v1alpha1/ingressroutes");
  if (!data?.items) return c.json({ available: false, ingressRoutes: [] });

  const ingressRoutes = data.items.map((item: any) => {
    const spec = item.spec || {};
    return {
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      entryPoints: spec.entryPoints || [],
      routes: (spec.routes || []).map((r: any) => ({
        match: r.match || "",
        services: (r.services || []).map((s: any) => ({
          name: s.name || "",
          namespace: s.namespace || item.metadata?.namespace || "",
          port: s.port,
          kind: s.kind || "Service",
        })),
        middlewares: (r.middlewares || []).map((m: any) => ({
          name: m.name || "",
          namespace: m.namespace || item.metadata?.namespace || "",
        })),
      })),
      tls: spec.tls
        ? {
            certResolver: spec.tls.certResolver || null,
            domains: spec.tls.domains || [],
            secretName: spec.tls.secretName || null,
          }
        : null,
    };
  });

  ingressRoutes.sort((a: any, b: any) =>
    `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`)
  );

  return c.json({ available: true, ingressRoutes });
});

// ── GET /middlewares — list all Traefik Middlewares ──
traefikRoutes.get("/middlewares", async (c) => {
  const data = await k8sApi("/apis/traefik.io/v1alpha1/middlewares");
  if (!data?.items) return c.json({ available: false, middlewares: [] });

  const middlewares = data.items.map((item: any) => {
    const spec = item.spec || {};
    // Detect middleware type from spec keys (e.g., headers, redirectScheme, stripPrefix)
    const specKeys = Object.keys(spec);
    const type = specKeys.length > 0 ? specKeys[0] : "unknown";
    return {
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      type,
      config: spec[type] || {},
    };
  });

  middlewares.sort((a: any, b: any) =>
    `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`)
  );

  return c.json({ available: true, middlewares });
});

// ── GET /entrypoints — Traefik entrypoints via Traefik API ──
traefikRoutes.get("/entrypoints", async (c) => {
  try {
    const res = await fetch("http://traefik.traefik.svc:9000/api/entrypoints");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    // Traefik API returns an array or object of entrypoints
    const items = Array.isArray(raw) ? raw : Object.values(raw);
    const entrypoints = items.map((ep: any) => ({
      name: ep.name || "",
      address: ep.address || "",
      protocol: ep.protocol || (ep.address?.includes(":443") ? "HTTPS" : "HTTP"),
    }));
    return c.json({ available: true, entrypoints });
  } catch {
    // Fallback: return standard Traefik entrypoints
    return c.json({
      available: false,
      entrypoints: [
        { name: "web", address: ":80", protocol: "HTTP" },
        { name: "websecure", address: ":443", protocol: "HTTPS" },
        { name: "traefik", address: ":9000", protocol: "HTTP" },
      ],
    });
  }
});

// ── GET /overview — Traefik dashboard overview stats ──
traefikRoutes.get("/overview", async (c) => {
  try {
    const res = await fetch("http://traefik.traefik.svc:9000/api/overview");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const overview = await res.json();
    return c.json({ available: true, overview });
  } catch {
    return c.json({ available: false, overview: null });
  }
});

// ── GET /health ──
traefikRoutes.get("/health", (c) => c.json({ module: "traefik", status: "ok" }));
