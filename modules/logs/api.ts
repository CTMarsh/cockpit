import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { k8sApi, k8sStream } from "../k8s-client";

export const logsRoutes = new OpenAPIHono();

const CONTAINER_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const NS_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

const sourcesRoute = createRoute({
  method: 'get', path: '/sources', tags: ['Logs'],
  description: 'List available log sources (k8s pods)',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Log sources' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } }
});
logsRoutes.openapi(sourcesRoute, async (c) => {
  try {
    const ns = c.req.query("namespace") || "";
    const path = ns ? `/api/v1/namespaces/${ns}/pods` : "/api/v1/pods";
    const data = await k8sApi(path);
    if (!data?.items) return c.json({ sources: [], error: "Unable to fetch pods from k8s API" } as any, 500);
    const sources = data.items.map((pod: any) => ({
      id: pod.metadata?.name || "",
      name: pod.metadata?.name || "",
      namespace: pod.metadata?.namespace || "",
      state: pod.status?.phase || "Unknown",
      containers: (pod.spec?.containers || []).map((ct: any) => ct.name),
      type: "pod"
    }));
    return c.json({ sources }, 200);
  } catch (e: any) {
    return c.json({ sources: [], error: e.message } as any, 500);
  }
});

const containerLogsRoute = createRoute({
  method: 'get', path: '/pod/{ns}/{name}', tags: ['Logs'],
  description: 'Get pod logs',
  request: { params: z.object({ ns: z.string(), name: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ lines: z.array(z.string()), pod: z.string(), count: z.number() }) } }, description: 'Pod logs' },
    400: { content: { 'application/json': { schema: z.any() } }, description: 'Validation error' },
    500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' },
  }
});
logsRoutes.openapi(containerLogsRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  if (!NS_RE.test(ns)) return c.json({ lines: [], error: "Invalid namespace" } as any, 400);
  if (!CONTAINER_NAME_RE.test(name)) return c.json({ lines: [], error: "Invalid pod name" } as any, 400);
  const container = c.req.query("container") || "";
  const tailRaw = c.req.query("tail") || "200";
  const tail = Math.min(Math.max(parseInt(tailRaw) || 200, 1), 10000);
  const sinceRaw = c.req.query("since") || "";
  try {
    let url = `/api/v1/namespaces/${ns}/pods/${name}/log?tailLines=${tail}&timestamps=true`;
    if (container && CONTAINER_NAME_RE.test(container)) url += `&container=${container}`;
    if (sinceRaw && /^\d+$/.test(sinceRaw)) url += `&sinceSeconds=${sinceRaw}`;
    const res = await k8sStream(url);
    if (!res) return c.json({ lines: [], error: "Unable to fetch logs" } as any, 500);
    const raw = await res.text();
    const lines = raw.split("\n").filter(Boolean);
    return c.json({ lines, pod: name, count: lines.length }, 200);
  } catch (e: any) {
    return c.json({ lines: [], error: e.message } as any, 500);
  }
});

const namespacesRoute = createRoute({
  method: 'get', path: '/namespaces', tags: ['Logs'],
  description: 'List available namespaces',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Namespace list' } }
});
logsRoutes.openapi(namespacesRoute, async (c) => {
  const data = await k8sApi("/api/v1/namespaces");
  if (!data?.items) return c.json({ namespaces: [] }, 200);
  const namespaces = data.items.map((ns: any) => ns.metadata?.name || "").filter(Boolean).sort();
  return c.json({ namespaces }, 200);
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Logs'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
logsRoutes.openapi(healthRoute, (c) => c.json({ module: "logs", status: "ok" }, 200));
