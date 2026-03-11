import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const markdownRoutes = new OpenAPIHono();

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

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Markdown'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
markdownRoutes.openapi(healthRoute, (c) => c.json({ module: "markdown", status: "ok" }, 200));

const listDocsRoute = createRoute({
  method: 'get', path: '/docs', tags: ['Markdown'],
  description: 'List all documents',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Document list' } }
});
markdownRoutes.openapi(listDocsRoute, (c) => {
  const docs = stmts.getAll.all();
  return c.json({ docs }, 200);
});

const getDocRoute = createRoute({
  method: 'get', path: '/docs/{id}', tags: ['Markdown'],
  description: 'Get a specific document',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Document' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
markdownRoutes.openapi(getDocRoute, (c) => {
  const doc = stmts.getById.get(c.req.valid('param').id) as any;
  if (!doc) return c.json({ error: "Document not found" } as any, 404);
  return c.json(doc, 200);
});

const saveDocRoute = createRoute({
  method: 'put', path: '/docs/{id}', tags: ['Markdown'],
  description: 'Create or update a document',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ content: z.string() }) } } }
  },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string(), title: z.string(), saved: z.boolean(), word_count: z.number(), size: z.number() }) } }, description: 'Document saved' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
markdownRoutes.openapi(saveDocRoute, async (c) => {
  const id = c.req.valid('param').id;
  const body = c.req.valid('json');
  if (body.content === undefined) return c.json({ error: "content is required" } as any, 400);
  const title = extractTitle(body.content);
  const wc = wordCount(body.content);
  stmts.upsert.run(id, title, body.content, wc);
  return c.json({ id, title, saved: true, word_count: wc, size: body.content.length }, 200);
});

const deleteDocRoute = createRoute({
  method: 'delete', path: '/docs/{id}', tags: ['Markdown'],
  description: 'Delete a document',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Document deleted' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
markdownRoutes.openapi(deleteDocRoute, (c) => {
  const id = c.req.valid('param').id;
  const existing = stmts.getById.get(id);
  if (!existing) return c.json({ error: "Document not found" } as any, 404);
  stmts.delete.run(id);
  return c.json({ deleted: id }, 200);
});

const searchRoute = createRoute({
  method: 'get', path: '/search', tags: ['Markdown'],
  description: 'Search documents by title or content',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ results: z.array(z.object({ id: z.string(), title: z.string(), snippet: z.string() })), total: z.number() }) } }, description: 'Search results' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
markdownRoutes.openapi(searchRoute, (c) => {
  const q = c.req.query("q")?.toLowerCase();
  if (!q) return c.json({ error: "q parameter is required" } as any, 400);
  const pattern = `%${q}%`;
  const rows = stmts.search.all(pattern) as any[];
  const results = rows.map((row) => {
    const idx = row.content.toLowerCase().indexOf(q);
    const snippet = row.content.slice(Math.max(0, idx - 40), idx + 80);
    return { id: row.id, title: row.title, snippet };
  });
  return c.json({ results, total: results.length }, 200);
});
