import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const graphRoutes = new OpenAPIHono();

const stmts = {
  getEdges: db.query("SELECT * FROM graph_edges ORDER BY created_at DESC"),
  upsertEdge: db.query(`
    INSERT INTO graph_edges (id, source_id, source_type, target_id, target_type, label, weight)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET weight = excluded.weight, label = excluded.label
  `),
  deleteEdge: db.query("DELETE FROM graph_edges WHERE id = ?"),
  getBookmarks: db.query("SELECT id, url, title, tags FROM bookmarks"),
  getDocuments: db.query("SELECT id, title FROM documents"),
};

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
graphRoutes.openapi(getNodesRoute, (c) => {
  const bookmarks = stmts.getBookmarks.all() as any[];
  const documents = stmts.getDocuments.all() as any[];
  const nodes: any[] = [];

  for (const b of bookmarks) {
    nodes.push({ id: `bookmark-${b.id}`, type: "bookmark", label: b.title, url: b.url, tags: JSON.parse(b.tags || "[]"), module: "bookmarks", moduleId: b.id });
  }
  for (const d of documents) {
    nodes.push({ id: `doc-${d.id}`, type: "document", label: d.title, module: "markdown", moduleId: d.id });
  }

  const autoEdges = buildTagEdges(bookmarks);
  const manualEdges = (stmts.getEdges.all() as any[]).map((e) => ({
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
  stmts.upsertEdge.run(id, body.sourceId, body.sourceType || "bookmark", body.targetId, body.targetType || "bookmark", body.label || "", 1);
  return c.json({ id, created: true }, 201);
});

const deleteEdgeRoute = createRoute({
  method: 'delete', path: '/edges/{id}', tags: ['Graph'],
  description: 'Delete an edge',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Edge deleted' } }
});
graphRoutes.openapi(deleteEdgeRoute, (c) => {
  const id = c.req.valid('param').id;
  stmts.deleteEdge.run(id);
  return c.json({ deleted: id }, 200);
});
