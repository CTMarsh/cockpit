import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { k8sApi, k8sStream } from "../k8s-client";

export const k8sRoutes = new OpenAPIHono();

const K8S_NAME_RE = /^[a-z0-9][a-z0-9.\-]{0,252}$/;

function validateK8sName(value: string, label: string): string | null {
  if (!value || !K8S_NAME_RE.test(value)) return `Invalid ${label}`;
  return null;
}

const namespacesRoute = createRoute({
  method: 'get', path: '/namespaces', tags: ['Kubernetes'],
  description: 'List all k8s namespaces',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Namespace list' } }
});
k8sRoutes.openapi(namespacesRoute, async (c) => {
  const data = await k8sApi("/api/v1/namespaces");
  if (!data?.items) return c.json({ available: false, namespaces: [] }, 200);
  const namespaces = data.items.map((ns: any) => ns.metadata.name).sort();
  return c.json({ available: true, namespaces }, 200);
});

const workloadsRoute = createRoute({
  method: 'get', path: '/workloads', tags: ['Kubernetes'],
  description: 'List deployments, statefulsets, daemonsets',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Workload list' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
k8sRoutes.openapi(workloadsRoute, async (c) => {
  const ns = c.req.query("namespace") || "";
  if (ns && !K8S_NAME_RE.test(ns)) return c.json({ error: "Invalid namespace" } as any, 400);
  const prefix = ns ? `/apis/apps/v1/namespaces/${ns}` : "/apis/apps/v1";
  const [deploys, statefulsets, daemonsets] = await Promise.all([k8sApi(`${prefix}/deployments`), k8sApi(`${prefix}/statefulsets`), k8sApi(`${prefix}/daemonsets`)]);
  if (!deploys && !statefulsets && !daemonsets) return c.json({ available: false, workloads: [], message: "Kubernetes API not available" }, 200);
  const workloads: any[] = [];
  for (const d of deploys?.items || []) { workloads.push({ name: d.metadata.name, namespace: d.metadata.namespace, type: "Deployment", ready: d.status?.readyReplicas || 0, desired: d.spec?.replicas || 0, image: d.spec?.template?.spec?.containers?.[0]?.image || "", age: d.metadata.creationTimestamp, conditions: (d.status?.conditions || []).map((c: any) => ({ type: c.type, status: c.status })) }); }
  for (const s of statefulsets?.items || []) { workloads.push({ name: s.metadata.name, namespace: s.metadata.namespace, type: "StatefulSet", ready: s.status?.readyReplicas || 0, desired: s.spec?.replicas || 0, image: s.spec?.template?.spec?.containers?.[0]?.image || "", age: s.metadata.creationTimestamp, conditions: [] }); }
  for (const d of daemonsets?.items || []) { workloads.push({ name: d.metadata.name, namespace: d.metadata.namespace, type: "DaemonSet", ready: d.status?.numberReady || 0, desired: d.status?.desiredNumberScheduled || 0, image: d.spec?.template?.spec?.containers?.[0]?.image || "", age: d.metadata.creationTimestamp, conditions: [] }); }
  workloads.sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  return c.json({ available: true, workloads } as any, 200);
});

const podLogsRoute = createRoute({
  method: 'get', path: '/pods/{ns}/{name}/logs', tags: ['Kubernetes'],
  description: 'Get pod log snapshot',
  request: { params: z.object({ ns: z.string(), name: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ logs: z.string() }) } }, description: 'Pod logs' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 502: { content: { 'application/json': { schema: z.any() } }, description: 'Upstream error' } }
});
k8sRoutes.openapi(podLogsRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  let err = validateK8sName(ns, "namespace") || validateK8sName(name, "pod name");
  if (err) return c.json({ error: err } as any, 400);
  const tail = String(Math.min(Math.max(parseInt(c.req.query("tail") || "100") || 100, 1), 10000));
  const container = c.req.query("container") || "";
  if (container && !K8S_NAME_RE.test(container)) return c.json({ error: "Invalid container name" } as any, 400);
  const qs = `tailLines=${tail}${container ? `&container=${container}` : ""}`;
  const res = await k8sStream(`/api/v1/namespaces/${ns}/pods/${name}/log?${qs}`);
  if (!res) return c.json({ logs: "", error: "Could not fetch logs" } as any, 502);
  const logs = await res.text();
  return c.json({ logs }, 200);
});

// SSE streaming routes — kept as regular Hono routes (not compatible with OpenAPI schema)
k8sRoutes.get("/pods/:ns/:name/logs/stream", async (c) => {
  const { ns, name } = c.req.param();
  let err = validateK8sName(ns, "namespace") || validateK8sName(name, "pod name");
  if (err) return c.json({ error: err }, 400);
  const container = c.req.query("container") || "";
  if (container && !K8S_NAME_RE.test(container)) return c.json({ error: "Invalid container name" }, 400);
  const tail = String(Math.min(Math.max(parseInt(c.req.query("tail") || "50") || 50, 1), 10000));
  const qs = `follow=true&tailLines=${tail}${container ? `&container=${container}` : ""}`;
  const res = await k8sStream(`/api/v1/namespaces/${ns}/pods/${name}/log?${qs}`);
  if (!res?.body) {
    return new Response("data: {\"error\":\"Could not connect to pod logs\"}\n\n", { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.enqueue(new TextEncoder().encode("data: {\"done\":true}\n\n")); controller.close(); return; }
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) { if (line) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ line })}\n\n`)); }
      } catch { controller.close(); }
    },
    cancel() { reader.cancel(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
});

const restartDeployRoute = createRoute({
  method: 'post', path: '/deployments/{ns}/{name}/restart', tags: ['Kubernetes'],
  description: 'Rolling restart a deployment',
  request: { params: z.object({ ns: z.string(), name: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Restart triggered' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Upstream error' },
  }
});
k8sRoutes.openapi(restartDeployRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  let err = validateK8sName(ns, "namespace") || validateK8sName(name, "deployment name");
  if (err) return c.json({ error: err } as any, 400);
  const patch = { spec: { template: { metadata: { annotations: { "kubectl.kubernetes.io/restartedAt": new Date().toISOString() } } } } };
  const res = await k8sApi(`/apis/apps/v1/namespaces/${ns}/deployments/${name}`, "PATCH", patch);
  if (!res) return c.json({ error: "Failed to restart deployment" } as any, 502);
  return c.json({ success: true, message: `Rolling restart triggered for ${name}` }, 200);
});

const scaleDeployRoute = createRoute({
  method: 'patch', path: '/deployments/{ns}/{name}/scale', tags: ['Kubernetes'],
  description: 'Scale deployment replicas',
  request: { params: z.object({ ns: z.string(), name: z.string() }), body: { content: { 'application/json': { schema: z.object({ replicas: z.number() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Scaled' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Upstream error' },
  }
});
k8sRoutes.openapi(scaleDeployRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  let err = validateK8sName(ns, "namespace") || validateK8sName(name, "deployment name");
  if (err) return c.json({ error: err } as any, 400);
  const body = c.req.valid('json');
  const replicas = Number(body.replicas);
  if (isNaN(replicas) || replicas < 0 || replicas > 20) return c.json({ error: "Replicas must be between 0 and 20" } as any, 400);
  const res = await k8sApi(`/apis/apps/v1/namespaces/${ns}/deployments/${name}/scale`, "PATCH", { spec: { replicas } });
  if (!res) return c.json({ error: "Failed to scale deployment" } as any, 502);
  return c.json({ success: true, message: `Scaled ${name} to ${replicas} replicas` }, 200);
});

const deletePodRoute = createRoute({
  method: 'delete', path: '/pods/{ns}/{name}', tags: ['Kubernetes'],
  description: 'Delete a pod',
  request: { params: z.object({ ns: z.string(), name: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string() }) } }, description: 'Pod deleted' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
    502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Upstream error' },
  }
});
k8sRoutes.openapi(deletePodRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  let err = validateK8sName(ns, "namespace") || validateK8sName(name, "pod name");
  if (err) return c.json({ error: err } as any, 400);
  const grace = Math.max(0, Math.min(Number(c.req.query("grace") ?? "30") || 30, 600));
  const res = await k8sApi(`/api/v1/namespaces/${ns}/pods/${name}`, "DELETE", { gracePeriodSeconds: grace });
  if (!res) return c.json({ error: "Failed to delete pod" } as any, 502);
  return c.json({ success: true, message: `Pod ${name} deleted` }, 200);
});

// SSE watch route — kept as regular Hono route
k8sRoutes.get("/watch", async (c) => {
  const ns = c.req.query("namespace") || "";
  if (ns && !K8S_NAME_RE.test(ns)) return c.json({ error: "Invalid namespace" }, 400);
  const path = ns ? `/api/v1/namespaces/${ns}/pods?watch=true` : "/api/v1/pods?watch=true";
  const res = await k8sStream(path);
  if (!res?.body) { return new Response("data: {\"error\":\"Watch not available\"}\n\n", { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }); }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            const pod = event.object;
            const containerStatuses = pod?.status?.containerStatuses || [];
            const ready = containerStatuses.filter((cs: any) => cs.ready).length;
            const total = containerStatuses.length;
            const data = { type: event.type, name: pod?.metadata?.name, namespace: pod?.metadata?.namespace, status: pod?.status?.phase || "Unknown", ready: `${ready}/${total}`, restarts: containerStatuses.reduce((s: number, cs: any) => s + (cs.restartCount || 0), 0), node: pod?.spec?.nodeName || "" };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* skip malformed */ }
        }
      } catch { controller.close(); }
    },
    cancel() { reader.cancel(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
});

const eventsRoute = createRoute({
  method: 'get', path: '/events', tags: ['Kubernetes'],
  description: 'Recent cluster events',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Event list' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
k8sRoutes.openapi(eventsRoute, async (c) => {
  const ns = c.req.query("namespace") || "";
  if (ns && !K8S_NAME_RE.test(ns)) return c.json({ error: "Invalid namespace" } as any, 400);
  const path = ns ? `/api/v1/namespaces/${ns}/events?limit=100` : "/api/v1/events?limit=100";
  const data = await k8sApi(path);
  if (!data?.items) return c.json({ available: false, events: [] }, 200);
  const events = data.items.map((e: any) => ({
    type: e.type || "Normal", reason: e.reason || "", message: e.message || "",
    object: `${e.involvedObject?.kind || ""}/${e.involvedObject?.name || ""}`,
    namespace: e.metadata?.namespace || "", count: e.count || 1,
    lastSeen: e.lastTimestamp || e.metadata?.creationTimestamp || "",
  })).sort((a: any, b: any) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  return c.json({ available: true, events } as any, 200);
});

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Kubernetes'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
k8sRoutes.openapi(healthRoute, (c) => c.json({ module: "k8s", status: "ok" }, 200));
