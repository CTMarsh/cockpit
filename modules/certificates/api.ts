import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { k8sApi } from "../k8s-client";

export const certificateRoutes = new OpenAPIHono();

const listCertsRoute = createRoute({ method: 'get', path: '/certificates', tags: ['Certificates'], description: 'List all certificates', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Certificate list' } } });
certificateRoutes.openapi(listCertsRoute, async (c) => {
  const data = await k8sApi("/apis/cert-manager.io/v1/certificates");
  if (!data || !data.items) return c.json({ certificates: [], error: "Unable to fetch certificates from cert-manager" }, 200);
  const certificates = data.items.map((item: any) => {
    const readyCondition = item.status?.conditions?.find((cond: any) => cond.type === "Ready");
    const notAfter = item.status?.notAfter || null;
    let daysUntilExpiry: number | null = null;
    if (notAfter) daysUntilExpiry = Math.floor((new Date(notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return { name: item.metadata?.name || "", namespace: item.metadata?.namespace || "", secretName: item.spec?.secretName || "", issuerName: item.spec?.issuerRef?.name || "", dnsNames: item.spec?.dnsNames || [], notBefore: item.status?.notBefore || null, notAfter, renewalTime: item.status?.renewalTime || null, ready: readyCondition?.status === "True", message: readyCondition?.message || "", daysUntilExpiry };
  });
  return c.json({ certificates } as any, 200);
});

const issuersRoute = createRoute({ method: 'get', path: '/issuers', tags: ['Certificates'], description: 'List ClusterIssuers and Issuers', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Issuer list' } } });
certificateRoutes.openapi(issuersRoute, async (c) => {
  const [clusterIssuers, namespacedIssuers] = await Promise.all([k8sApi("/apis/cert-manager.io/v1/clusterissuers"), k8sApi("/apis/cert-manager.io/v1/issuers")]);
  const issuers: any[] = [];
  function mapIssuer(item: any, kind: string) {
    const readyCondition = item.status?.conditions?.find((cond: any) => cond.type === "Ready");
    let type = "Unknown"; if (item.spec?.acme) type = "ACME"; else if (item.spec?.ca) type = "CA"; else if (item.spec?.selfSigned) type = "SelfSigned"; else if (item.spec?.vault) type = "Vault"; else if (item.spec?.venafi) type = "Venafi";
    return { name: item.metadata?.name || "", namespace: item.metadata?.namespace || "", kind, type, ready: readyCondition?.status === "True", server: item.spec?.acme?.server || null, email: item.spec?.acme?.email || null };
  }
  if (clusterIssuers?.items) for (const item of clusterIssuers.items) issuers.push(mapIssuer(item, "ClusterIssuer"));
  if (namespacedIssuers?.items) for (const item of namespacedIssuers.items) issuers.push(mapIssuer(item, "Issuer"));
  return c.json({ issuers } as any, 200);
});

const checkCertRoute = createRoute({ method: 'get', path: '/check/{ns}/{name}', tags: ['Certificates'], description: 'Detailed certificate check', request: { params: z.object({ ns: z.string(), name: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Certificate detail' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
certificateRoutes.openapi(checkCertRoute, async (c) => {
  const { ns, name } = c.req.valid('param');
  const data = await k8sApi(`/apis/cert-manager.io/v1/namespaces/${ns}/certificates/${name}`);
  if (!data) return c.json({ error: "Certificate not found" } as any, 404);
  const notAfter = data.status?.notAfter || null;
  let daysUntilExpiry: number | null = null;
  if (notAfter) daysUntilExpiry = Math.floor((new Date(notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return c.json({ name: data.metadata?.name || "", namespace: data.metadata?.namespace || "", secretName: data.spec?.secretName || "", issuerName: data.spec?.issuerRef?.name || "", dnsNames: data.spec?.dnsNames || [], notBefore: data.status?.notBefore || null, notAfter, renewalTime: data.status?.renewalTime || null, daysUntilExpiry, conditions: data.status?.conditions || [], revision: data.status?.revision || null, lastFailureTime: data.status?.lastFailureTime || null } as any, 200);
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Certificates'], responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Module health' } } });
certificateRoutes.openapi(healthRoute, async (c) => {
  const data = await k8sApi("/apis/cert-manager.io/v1/certificates?limit=1");
  if (data === null) return c.json({ healthy: false, message: "cert-manager CRDs not accessible" }, 200);
  return c.json({ healthy: true, message: "cert-manager CRDs accessible" }, 200);
});
