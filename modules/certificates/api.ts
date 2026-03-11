import { Hono } from "hono";
import { k8sApi } from "../k8s-client";

export const certificateRoutes = new Hono();

// ── GET /certificates — list all certificates across namespaces ──
certificateRoutes.get("/certificates", async (c) => {
  const data = await k8sApi("/apis/cert-manager.io/v1/certificates");
  if (!data || !data.items) {
    return c.json({ certificates: [], error: "Unable to fetch certificates from cert-manager" });
  }

  const certificates = data.items.map((item: any) => {
    const readyCondition = item.status?.conditions?.find(
      (cond: any) => cond.type === "Ready"
    );
    const notAfter = item.status?.notAfter || null;
    let daysUntilExpiry: number | null = null;
    if (notAfter) {
      const expiryMs = new Date(notAfter).getTime() - Date.now();
      daysUntilExpiry = Math.floor(expiryMs / (1000 * 60 * 60 * 24));
    }

    return {
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      secretName: item.spec?.secretName || "",
      issuerName: item.spec?.issuerRef?.name || "",
      dnsNames: item.spec?.dnsNames || [],
      notBefore: item.status?.notBefore || null,
      notAfter,
      renewalTime: item.status?.renewalTime || null,
      ready: readyCondition?.status === "True",
      message: readyCondition?.message || "",
      daysUntilExpiry,
    };
  });

  return c.json({ certificates });
});

// ── GET /issuers — list ClusterIssuers and Issuers ──
certificateRoutes.get("/issuers", async (c) => {
  const [clusterIssuers, namespacedIssuers] = await Promise.all([
    k8sApi("/apis/cert-manager.io/v1/clusterissuers"),
    k8sApi("/apis/cert-manager.io/v1/issuers"),
  ]);

  const issuers: any[] = [];

  function mapIssuer(item: any, kind: string) {
    const readyCondition = item.status?.conditions?.find(
      (cond: any) => cond.type === "Ready"
    );

    // Determine issuer type
    let type = "Unknown";
    if (item.spec?.acme) type = "ACME";
    else if (item.spec?.ca) type = "CA";
    else if (item.spec?.selfSigned) type = "SelfSigned";
    else if (item.spec?.vault) type = "Vault";
    else if (item.spec?.venafi) type = "Venafi";

    return {
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      kind,
      type,
      ready: readyCondition?.status === "True",
      server: item.spec?.acme?.server || null,
      email: item.spec?.acme?.email || null,
    };
  }

  if (clusterIssuers?.items) {
    for (const item of clusterIssuers.items) {
      issuers.push(mapIssuer(item, "ClusterIssuer"));
    }
  }

  if (namespacedIssuers?.items) {
    for (const item of namespacedIssuers.items) {
      issuers.push(mapIssuer(item, "Issuer"));
    }
  }

  return c.json({ issuers });
});

// ── GET /check/:ns/:name — detailed check of a specific certificate ──
certificateRoutes.get("/check/:ns/:name", async (c) => {
  const ns = c.req.param("ns");
  const name = c.req.param("name");

  const data = await k8sApi(
    `/apis/cert-manager.io/v1/namespaces/${ns}/certificates/${name}`
  );
  if (!data) {
    return c.json({ error: "Certificate not found" }, 404);
  }

  const notAfter = data.status?.notAfter || null;
  let daysUntilExpiry: number | null = null;
  if (notAfter) {
    const expiryMs = new Date(notAfter).getTime() - Date.now();
    daysUntilExpiry = Math.floor(expiryMs / (1000 * 60 * 60 * 24));
  }

  return c.json({
    name: data.metadata?.name || "",
    namespace: data.metadata?.namespace || "",
    secretName: data.spec?.secretName || "",
    issuerName: data.spec?.issuerRef?.name || "",
    dnsNames: data.spec?.dnsNames || [],
    notBefore: data.status?.notBefore || null,
    notAfter,
    renewalTime: data.status?.renewalTime || null,
    daysUntilExpiry,
    conditions: data.status?.conditions || [],
    revision: data.status?.revision || null,
    lastFailureTime: data.status?.lastFailureTime || null,
  });
});

// ── GET /health — module health (checks if cert-manager CRDs are accessible) ──
certificateRoutes.get("/health", async (c) => {
  const data = await k8sApi("/apis/cert-manager.io/v1/certificates?limit=1");
  if (data === null) {
    return c.json({ healthy: false, message: "cert-manager CRDs not accessible" });
  }
  return c.json({ healthy: true, message: "cert-manager CRDs accessible" });
});
