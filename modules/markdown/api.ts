import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const markdownRoutes = new Hono();

const stmts = {
  getAll: db.query("SELECT id, title, word_count, created_at, updated_at, LENGTH(content) as size FROM documents ORDER BY updated_at DESC"),
  getById: db.query("SELECT * FROM documents WHERE id = ?"),
  upsert: db.query(`
    INSERT INTO documents (id, title, content, word_count, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      word_count = excluded.word_count,
      updated_at = datetime('now')
  `),
  delete: db.query("DELETE FROM documents WHERE id = ?"),
  search: db.query("SELECT id, title, content FROM documents WHERE title LIKE ?1 OR content LIKE ?1 ORDER BY updated_at DESC"),
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractTitle(content: string): string {
  const firstLine = content.split("\n")[0]?.replace(/^#\s*/, "").trim();
  return firstLine || "Untitled";
}

markdownRoutes.get("/health", (c) => c.json({ module: "markdown", status: "ok" }));

markdownRoutes.get("/docs", (c) => {
  const docs = stmts.getAll.all();
  return c.json({ docs });
});

markdownRoutes.get("/docs/:id", (c) => {
  const doc = stmts.getById.get(c.req.param("id")) as any;
  if (!doc) return c.json({ error: "Document not found" }, 404);
  return c.json(doc);
});

markdownRoutes.put("/docs/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ content: string }>();
  if (body.content === undefined) return c.json({ error: "content is required" }, 400);
  const title = extractTitle(body.content);
  const wc = wordCount(body.content);
  stmts.upsert.run(id, title, body.content, wc);
  return c.json({ id, title, saved: true, word_count: wc, size: body.content.length });
});

markdownRoutes.delete("/docs/:id", (c) => {
  const id = c.req.param("id");
  const existing = stmts.getById.get(id);
  if (!existing) return c.json({ error: "Document not found" }, 404);
  stmts.delete.run(id);
  return c.json({ deleted: id });
});

markdownRoutes.get("/search", (c) => {
  const q = c.req.query("q")?.toLowerCase();
  if (!q) return c.json({ error: "q parameter is required" }, 400);
  const pattern = `%${q}%`;
  const rows = stmts.search.all(pattern) as any[];
  const results = rows.map((row) => {
    const idx = row.content.toLowerCase().indexOf(q);
    const snippet = row.content.slice(Math.max(0, idx - 40), idx + 80);
    return { id: row.id, title: row.title, snippet };
  });
  return c.json({ results, total: results.length });
});
