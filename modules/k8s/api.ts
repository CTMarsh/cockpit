import { Hono } from "hono";
import { k8sApi, k8sStream } from "../k8s-client";

export const k8sRoutes = new Hono();

// ── GET /namespaces — list all namespaces ──
k8sRoutes.get("/namespaces", async (c) => {
  const data = await k8sApi("/api/v1/namespaces");
  if (!data?.items) return c.json({ available: false, namespaces: [] });
  const namespaces = data.items.map((ns: any) => ns.metadata.name).sort();
  return c.json({ available: true, namespaces });
});

// ── GET /workloads — list deployments, statefulsets, daemonsets ──
k8sRoutes.get("/workloads", async (c) => {
  const ns = c.req.query("namespace") || "";
  const prefix = ns ? `/apis/apps/v1/namespaces/${ns}` : "/apis/apps/v1";

  const [deploys, statefulsets, daemonsets] = await Promise.all([
    k8sApi(`${prefix}/deployments`),
    k8sApi(`${prefix}/statefulsets`),
    k8sApi(`${prefix}/daemonsets`),
  ]);

  if (!deploys && !statefulsets && !daemonsets) {
    return c.json({ available: false, workloads: [], message: "Kubernetes API not available" });
  }

  const workloads: any[] = [];

  for (const d of deploys?.items || []) {
    workloads.push({
      name: d.metadata.name,
      namespace: d.metadata.namespace,
      type: "Deployment",
      ready: d.status?.readyReplicas || 0,
      desired: d.spec?.replicas || 0,
      image: d.spec?.template?.spec?.containers?.[0]?.image || "",
      age: d.metadata.creationTimestamp,
      conditions: (d.status?.conditions || []).map((c: any) => ({ type: c.type, status: c.status })),
    });
  }

  for (const s of statefulsets?.items || []) {
    workloads.push({
      name: s.metadata.name,
      namespace: s.metadata.namespace,
      type: "StatefulSet",
      ready: s.status?.readyReplicas || 0,
      desired: s.spec?.replicas || 0,
      image: s.spec?.template?.spec?.containers?.[0]?.image || "",
      age: s.metadata.creationTimestamp,
      conditions: [],
    });
  }

  for (const d of daemonsets?.items || []) {
    workloads.push({
      name: d.metadata.name,
      namespace: d.metadata.namespace,
      type: "DaemonSet",
      ready: d.status?.numberReady || 0,
      desired: d.status?.desiredNumberScheduled || 0,
      image: d.spec?.template?.spec?.containers?.[0]?.image || "",
      age: d.metadata.creationTimestamp,
      conditions: [],
    });
  }

  workloads.sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  return c.json({ available: true, workloads });
});

// ── GET /pods/:ns/:name/logs — pod log snapshot ──
k8sRoutes.get("/pods/:ns/:name/logs", async (c) => {
  const { ns, name } = c.req.param();
  const tail = c.req.query("tail") || "100";
  const container = c.req.query("container") || "";
  const qs = `tailLines=${tail}${container ? `&container=${container}` : ""}`;

  const res = await k8sStream(`/api/v1/namespaces/${ns}/pods/${name}/log?${qs}`);
  if (!res) return c.json({ logs: "", error: "Could not fetch logs" }, 502);

  const logs = await res.text();
  return c.json({ logs });
});

// ── GET /pods/:ns/:name/logs/stream — SSE log stream ──
k8sRoutes.get("/pods/:ns/:name/logs/stream", async (c) => {
  const { ns, name } = c.req.param();
  const container = c.req.query("container") || "";
  const tail = c.req.query("tail") || "50";
  const qs = `follow=true&tailLines=${tail}${container ? `&container=${container}` : ""}`;

  const res = await k8sStream(`/api/v1/namespaces/${ns}/pods/${name}/log?${qs}`);
  if (!res?.body) {
    return new Response("data: {\"error\":\"Could not connect to pod logs\"}\n\n", {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(new TextEncoder().encode("data: {\"done\":true}\n\n"));
          controller.close();
          return;
        }
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (line) controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ line })}\n\n`));
        }
      } catch {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});

// ── POST /deployments/:ns/:name/restart — rolling restart ──
k8sRoutes.post("/deployments/:ns/:name/restart", async (c) => {
  const { ns, name } = c.req.param();
  const patch = {
    spec: {
      template: {
        metadata: {
          annotations: {
            "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
          },
        },
      },
    },
  };

  const res = await k8sApi(
    `/apis/apps/v1/namespaces/${ns}/deployments/${name}`,
    "PATCH",
    patch
  );

  if (!res) return c.json({ error: "Failed to restart deployment" }, 502);
  return c.json({ success: true, message: `Rolling restart triggered for ${name}` });
});

// ── PATCH /deployments/:ns/:name/scale — scale replicas ──
k8sRoutes.patch("/deployments/:ns/:name/scale", async (c) => {
  const { ns, name } = c.req.param();
  const body = await c.req.json();
  const replicas = Number(body.replicas);

  if (isNaN(replicas) || replicas < 0 || replicas > 20) {
    return c.json({ error: "Replicas must be between 0 and 20" }, 400);
  }

  const res = await k8sApi(
    `/apis/apps/v1/namespaces/${ns}/deployments/${name}/scale`,
    "PATCH",
    { spec: { replicas } }
  );

  if (!res) return c.json({ error: "Failed to scale deployment" }, 502);
  return c.json({ success: true, message: `Scaled ${name} to ${replicas} replicas` });
});

// ── DELETE /pods/:ns/:name — delete pod ──
k8sRoutes.delete("/pods/:ns/:name", async (c) => {
  const { ns, name } = c.req.param();
  const grace = Number(c.req.query("grace") ?? "30");

  const res = await k8sApi(
    `/api/v1/namespaces/${ns}/pods/${name}`,
    "DELETE",
    { gracePeriodSeconds: grace }
  );

  if (!res) return c.json({ error: "Failed to delete pod" }, 502);
  return c.json({ success: true, message: `Pod ${name} deleted` });
});

// ── GET /watch — SSE watch for pod and deployment events ──
k8sRoutes.get("/watch", async (c) => {
  const ns = c.req.query("namespace") || "";
  const path = ns
    ? `/api/v1/namespaces/${ns}/pods?watch=true`
    : "/api/v1/pods?watch=true";

  const res = await k8sStream(path);
  if (!res?.body) {
    return new Response("data: {\"error\":\"Watch not available\"}\n\n", {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

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
            const data = {
              type: event.type,
              name: pod?.metadata?.name,
              namespace: pod?.metadata?.namespace,
              status: pod?.status?.phase || "Unknown",
              ready: `${ready}/${total}`,
              restarts: containerStatuses.reduce((s: number, cs: any) => s + (cs.restartCount || 0), 0),
              node: pod?.spec?.nodeName || "",
            };
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* skip malformed */ }
        }
      } catch {
        controller.close();
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});

// ── GET /events — recent cluster events ──
k8sRoutes.get("/events", async (c) => {
  const ns = c.req.query("namespace") || "";
  const path = ns
    ? `/api/v1/namespaces/${ns}/events?limit=100`
    : "/api/v1/events?limit=100";

  const data = await k8sApi(path);
  if (!data?.items) return c.json({ available: false, events: [] });

  const events = data.items
    .map((e: any) => ({
      type: e.type || "Normal",
      reason: e.reason || "",
      message: e.message || "",
      object: `${e.involvedObject?.kind || ""}/${e.involvedObject?.name || ""}`,
      namespace: e.metadata?.namespace || "",
      count: e.count || 1,
      lastSeen: e.lastTimestamp || e.metadata?.creationTimestamp || "",
    }))
    .sort((a: any, b: any) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return c.json({ available: true, events });
});

// ── GET /health ──
k8sRoutes.get("/health", (c) => c.json({ module: "k8s", status: "ok" }));
