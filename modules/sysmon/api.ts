import { Hono } from "hono";
import { k8sApi } from "../k8s-client";

export const sysmonRoutes = new Hono();

// ── Proxmox API helper (reuse config from proxmox module) ──
const PVE_URL = process.env.PVE_URL || "";
const PVE_TOKEN = process.env.PVE_TOKEN || "";

async function pveApi(path: string): Promise<any> {
  if (!PVE_URL || !PVE_TOKEN) return null;
  const res = await fetch(`${PVE_URL}/api2/json${path}`, {
    headers: { Authorization: `PVEAPIToken=${PVE_TOKEN}` },
    // @ts-ignore — Bun supports this for self-signed certs
    tls: { rejectUnauthorized: false },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

// ── GET /api/sysmon/cluster — aggregate cluster metrics from Proxmox nodes ──
sysmonRoutes.get("/cluster", async (c) => {
  try {
    const nodes = await pveApi("/nodes");
    if (!nodes || !Array.isArray(nodes)) {
      return c.json({ configured: false, message: "Proxmox not configured" });
    }

    const onlineNodes = nodes.filter((n: any) => n.status === "online");
    const totalCpu = onlineNodes.reduce((s: number, n: any) => s + (n.maxcpu || 0), 0);
    const usedCpu = onlineNodes.reduce((s: number, n: any) => s + (n.cpu || 0) * (n.maxcpu || 0), 0);
    const totalMem = onlineNodes.reduce((s: number, n: any) => s + (n.maxmem || 0), 0);
    const usedMem = onlineNodes.reduce((s: number, n: any) => s + (n.mem || 0), 0);
    const totalDisk = onlineNodes.reduce((s: number, n: any) => s + (n.maxdisk || 0), 0);
    const usedDisk = onlineNodes.reduce((s: number, n: any) => s + (n.disk || 0), 0);

    return c.json({
      configured: true,
      nodeCount: nodes.length,
      onlineCount: onlineNodes.length,
      cpu: {
        cores: totalCpu,
        usedPercent: totalCpu > 0 ? Math.round((usedCpu / totalCpu) * 1000) / 10 : 0,
      },
      memory: {
        totalGB: Math.round(totalMem / 1073741824 * 10) / 10,
        usedGB: Math.round(usedMem / 1073741824 * 10) / 10,
        percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
      },
      disk: {
        totalGB: Math.round(totalDisk / 1073741824 * 10) / 10,
        usedGB: Math.round(usedDisk / 1073741824 * 10) / 10,
        percent: totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 1000) / 10 : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return c.json({ configured: false, error: e.message }, 500);
  }
});

// ── GET /api/sysmon/nodes — per-node stats from Proxmox ──
sysmonRoutes.get("/nodes", async (c) => {
  try {
    const nodes = await pveApi("/nodes");
    if (!nodes || !Array.isArray(nodes)) {
      return c.json({ nodes: [] });
    }

    return c.json({
      nodes: nodes.map((n: any) => ({
        name: n.node,
        status: n.status,
        uptime: n.uptime || 0,
        cpu: {
          cores: n.maxcpu || 0,
          percent: Math.round((n.cpu || 0) * 1000) / 10,
        },
        memory: {
          totalGB: Math.round((n.maxmem || 0) / 1073741824 * 10) / 10,
          usedGB: Math.round((n.mem || 0) / 1073741824 * 10) / 10,
          percent: n.maxmem ? Math.round((n.mem / n.maxmem) * 1000) / 10 : 0,
        },
        disk: {
          totalGB: Math.round((n.maxdisk || 0) / 1073741824 * 10) / 10,
          usedGB: Math.round((n.disk || 0) / 1073741824 * 10) / 10,
          percent: n.maxdisk ? Math.round((n.disk / n.maxdisk) * 1000) / 10 : 0,
        },
      })),
    });
  } catch (e: any) {
    return c.json({ nodes: [], error: e.message }, 500);
  }
});

// ── GET /api/sysmon/pods — k8s pod list ──
sysmonRoutes.get("/pods", async (c) => {
  const namespace = c.req.query("namespace") || "";
  const path = namespace ? `/api/v1/namespaces/${namespace}/pods` : "/api/v1/pods";

  const data = await k8sApi(path);
  if (!data || !data.items) {
    return c.json({
      available: false,
      pods: [],
      message: "Kubernetes API not available. Pod metrics require in-cluster access or K8S_TOKEN env var.",
    });
  }

  const pods = data.items.map((p: any) => {
    const containerStatuses = p.status?.containerStatuses || [];
    const restarts = containerStatuses.reduce((s: number, cs: any) => s + (cs.restartCount || 0), 0);
    const ready = containerStatuses.filter((cs: any) => cs.ready).length;
    const total = containerStatuses.length;

    return {
      name: p.metadata.name,
      namespace: p.metadata.namespace,
      status: p.status?.phase || "Unknown",
      ready: `${ready}/${total}`,
      restarts,
      age: p.metadata.creationTimestamp,
      node: p.spec?.nodeName || "",
      containers: containerStatuses.map((cs: any) => ({
        name: cs.name,
        ready: cs.ready,
        restarts: cs.restartCount || 0,
        state: Object.keys(cs.state || {})[0] || "unknown",
      })),
    };
  });

  // Sort: running first, then by namespace/name
  pods.sort((a: any, b: any) => {
    if (a.status === "Running" && b.status !== "Running") return -1;
    if (a.status !== "Running" && b.status === "Running") return 1;
    return `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`);
  });

  return c.json({ available: true, pods });
});

// ── GET /api/sysmon/health ──
sysmonRoutes.get("/health", (c) => c.json({ module: "sysmon", status: "ok" }));
