import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const deployHistoryRoutes = new OpenAPIHono();

const eventsRoute = createRoute({
  method: 'get', path: '/events', tags: ['Deploy History'],
  description: 'List deployment events with filtering',
  responses: { 200: { content: { 'application/json': { schema: z.object({ events: z.array(z.any()), total: z.number() }) } }, description: 'Deployment events' } }
});
deployHistoryRoutes.openapi(eventsRoute, async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;
  const deployment = c.req.query("deployment");
  const namespace = c.req.query("namespace");
  let events;
  if (deployment && namespace) events = await sql`SELECT * FROM deployment_events WHERE deployment = ${deployment} AND namespace = ${namespace} ORDER BY started_at DESC LIMIT ${limit}`;
  else if (namespace) events = await sql`SELECT * FROM deployment_events WHERE namespace = ${namespace} ORDER BY started_at DESC LIMIT ${limit}`;
  else events = await sql`SELECT * FROM deployment_events ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const [row] = await sql`SELECT COUNT(*)::int as count FROM deployment_events`;
  const total = row?.count || 0;
  return c.json({ events: events as any[], total }, 200);
});

const recordRoute = createRoute({
  method: 'post', path: '/record', tags: ['Deploy History'],
  description: 'Record a deployment event',
  request: { body: { content: { 'application/json': { schema: z.object({ deployment: z.string(), namespace: z.string(), image: z.string(), previous_image: z.string().optional(), status: z.string().optional(), triggered_by: z.string().optional() }) } } } },
  responses: { 201: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Event recorded' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } }
});
deployHistoryRoutes.openapi(recordRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.deployment || !body.namespace || !body.image) return c.json({ error: "deployment, namespace, and image are required" } as any, 400);
  await sql`INSERT INTO deployment_events (deployment, namespace, image, previous_image, status, triggered_by) VALUES (${body.deployment}, ${body.namespace}, ${body.image}, ${body.previous_image || ""}, ${body.status || "started"}, ${body.triggered_by || "ci"})`;
  return c.json({ ok: true }, 201);
});

export async function recordDeployEvent(deployment: string, namespace: string, image: string, previousImage = "", status = "completed", triggeredBy = "ci") {
  await sql`INSERT INTO deployment_events (deployment, namespace, image, previous_image, status, triggered_by) VALUES (${deployment}, ${namespace}, ${image}, ${previousImage}, ${status}, ${triggeredBy})`;
}
