import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const graphRoutes = new OpenAPIHono();

function buildTagEdges(bookmarks: any[]) {
  const edges: any[] = [];
  for (let i = 0; i < bookmarks.length; i++) {
    const tags_i = JSON.parse(bookmarks[i].tags || "[]");
    for (let j = i + 1; j < bookmarks.length; j++) {
      const tags_j = JSON.parse(bookmarks[j].tags || "[]");
      const shared = tags_i.filter((t: string) => tags_j.includes(t));
      if (shared.length > 0) {
        const edgeId = [bookmarks[i].id, bookmarks[j].id].sort().join("-");
        edges.push({
          id: edgeId,
          source: `bookmark-${bookmarks[i].id}`,
          target: `bookmark-${bookmarks[j].id}`,
          label: shared.join(", "),
          weight: shared.length,
        });
      }
    }
  }
  return edges;
}

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Graph'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
graphRoutes.openapi(healthRoute, (c) => c.json({ module: "graph", status: "ok" }, 200));

const getNodesRoute = createRoute({
  method: 'get', path: '/nodes', tags: ['Graph'],
  description: 'Get knowledge graph nodes and edges',
  responses: { 200: { content: { 'application/json': { schema: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
    summary: z.object({ totalNodes: z.number(), totalEdges: z.number(), types: z.object({ bookmarks: z.number(), documents: z.number() }) }),
  }) } }, description: 'Graph data' } }
});
graphRoutes.openapi(getNodesRoute, async (c) => {
  const bookmarks = await sql`SELECT id, url, title, tags FROM bookmarks` as any[];
  const documents = await sql`SELECT id, title FROM documents` as any[];
  const nodes: any[] = [];

  for (const b of bookmarks) {
    nodes.push({ id: `bookmark-${b.id}`, type: "bookmark", label: b.title, url: b.url, tags: JSON.parse(b.tags || "[]"), module: "bookmarks", moduleId: b.id });
  }
  for (const d of documents) {
    nodes.push({ id: `doc-${d.id}`, type: "document", label: d.title, module: "markdown", moduleId: d.id });
  }

  const autoEdges = buildTagEdges(bookmarks);
  const manualEdgeRows = await sql`SELECT * FROM graph_edges ORDER BY created_at DESC` as any[];
  const manualEdges = manualEdgeRows.map((e) => ({
    id: e.id, source: `${e.source_type}-${e.source_id}`, target: `${e.target_type}-${e.target_id}`, label: e.label, weight: e.weight,
  }));
  const edges = [...autoEdges, ...manualEdges];

  return c.json({
    nodes, edges,
    summary: { totalNodes: nodes.length, totalEdges: edges.length, types: { bookmarks: bookmarks.length, documents: documents.length } },
  } as any, 200);
});

const createEdgeRoute = createRoute({
  method: 'post', path: '/edges', tags: ['Graph'],
  description: 'Create a manual edge between nodes',
  request: { body: { content: { 'application/json': { schema: z.object({ sourceId: z.string(), sourceType: z.string().optional(), targetId: z.string(), targetType: z.string().optional(), label: z.string().optional() }) } } } },
  responses: {
    201: { content: { 'application/json': { schema: z.object({ id: z.string(), created: z.boolean() }) } }, description: 'Edge created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
graphRoutes.openapi(createEdgeRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.sourceId || !body.targetId) {
    return c.json({ error: "sourceId and targetId are required" } as any, 400);
  }
  const id = crypto.randomUUID();
  const sourceType = body.sourceType || "bookmark";
  const targetType = body.targetType || "bookmark";
  const label = body.label || "";
  await sql`
    INSERT INTO graph_edges (id, source_id, source_type, target_id, target_type, label, weight)
    VALUES (${id}, ${body.sourceId}, ${sourceType}, ${body.targetId}, ${targetType}, ${label}, ${1})
    ON CONFLICT(id) DO UPDATE SET weight = EXCLUDED.weight, label = EXCLUDED.label
  `;
  return c.json({ id, created: true }, 201);
});

const deleteEdgeRoute = createRoute({
  method: 'delete', path: '/edges/{id}', tags: ['Graph'],
  description: 'Delete an edge',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Edge deleted' } }
});
graphRoutes.openapi(deleteEdgeRoute, async (c) => {
  const id = c.req.valid('param').id;
  await sql`DELETE FROM graph_edges WHERE id = ${id}`;
  return c.json({ deleted: id }, 200);
});
