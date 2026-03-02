import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const graphRoutes = new Hono();

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

graphRoutes.get("/health", (c) => c.json({ module: "graph", status: "ok" }));

graphRoutes.get("/nodes", (c) => {
  const bookmarks = stmts.getBookmarks.all() as any[];
  const documents = stmts.getDocuments.all() as any[];

  const nodes: any[] = [];

  for (const b of bookmarks) {
    nodes.push({
      id: `bookmark-${b.id}`,
      type: "bookmark",
      label: b.title,
      url: b.url,
      tags: JSON.parse(b.tags || "[]"),
      module: "bookmarks",
      moduleId: b.id,
    });
  }

  for (const d of documents) {
    nodes.push({
      id: `doc-${d.id}`,
      type: "document",
      label: d.title,
      module: "markdown",
      moduleId: d.id,
    });
  }

  // Auto-generated edges from shared tags
  const autoEdges = buildTagEdges(bookmarks);

  // Manually created edges from DB
  const manualEdges = (stmts.getEdges.all() as any[]).map((e) => ({
    id: e.id,
    source: `${e.source_type}-${e.source_id}`,
    target: `${e.target_type}-${e.target_id}`,
    label: e.label,
    weight: e.weight,
  }));

  const edges = [...autoEdges, ...manualEdges];

  return c.json({
    nodes,
    edges,
    summary: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      types: {
        bookmarks: bookmarks.length,
        documents: documents.length,
      },
    },
  });
});

// Manually create an edge between any two nodes
graphRoutes.post("/edges", async (c) => {
  const body = await c.req.json<{
    sourceId: string;
    sourceType: string;
    targetId: string;
    targetType: string;
    label?: string;
  }>();
  if (!body.sourceId || !body.targetId) {
    return c.json({ error: "sourceId and targetId are required" }, 400);
  }
  const id = crypto.randomUUID();
  stmts.upsertEdge.run(
    id,
    body.sourceId,
    body.sourceType || "bookmark",
    body.targetId,
    body.targetType || "bookmark",
    body.label || "",
    1
  );
  return c.json({ id, created: true }, 201);
});

graphRoutes.delete("/edges/:id", (c) => {
  const id = c.req.param("id");
  stmts.deleteEdge.run(id);
  return c.json({ deleted: id });
});
