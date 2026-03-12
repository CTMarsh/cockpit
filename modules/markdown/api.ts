import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const markdownRoutes = new OpenAPIHono();

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
markdownRoutes.openapi(listDocsRoute, async (c) => {
  const docs = await sql`SELECT id, title, word_count, created_at, updated_at, LENGTH(content) as size FROM documents ORDER BY updated_at DESC`;
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
markdownRoutes.openapi(getDocRoute, async (c) => {
  const [doc] = await sql`SELECT * FROM documents WHERE id = ${c.req.valid('param').id}`;
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
  await sql`
    INSERT INTO documents (id, title, content, word_count, updated_at)
    VALUES (${id}, ${title}, ${body.content}, ${wc}, NOW())
    ON CONFLICT(id) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      word_count = EXCLUDED.word_count,
      updated_at = NOW()
  `;
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
markdownRoutes.openapi(deleteDocRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM documents WHERE id = ${id}`;
  if (!existing) return c.json({ error: "Document not found" } as any, 404);
  await sql`DELETE FROM documents WHERE id = ${id}`;
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
markdownRoutes.openapi(searchRoute, async (c) => {
  const q = c.req.query("q")?.toLowerCase();
  if (!q) return c.json({ error: "q parameter is required" } as any, 400);
  const pattern = `%${q}%`;
  const rows = await sql`SELECT id, title, content FROM documents WHERE title LIKE ${pattern} OR content LIKE ${pattern} ORDER BY updated_at DESC` as any[];
  const results = rows.map((row) => {
    const idx = row.content.toLowerCase().indexOf(q);
    const snippet = row.content.slice(Math.max(0, idx - 40), idx + 80);
    return { id: row.id, title: row.title, snippet };
  });
  return c.json({ results, total: results.length }, 200);
});
