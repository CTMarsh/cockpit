import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import sql from "../../apps/api/src/db";

export const bookmarksRoutes = new OpenAPIHono();

function parseBookmark(row: any) {
  return { ...row, tags: JSON.parse(row.tags || "[]") };
}

// ── SSRF prevention ──
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isUrlSafe(urlString: string): { safe: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { safe: false, error: "Only http and https URLs are allowed" };
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "[::1]") {
      return { safe: false, error: "Internal addresses are not allowed" };
    }
    for (const pattern of PRIVATE_IP_RANGES) {
      if (pattern.test(hostname)) {
        return { safe: false, error: "Internal addresses are not allowed" };
      }
    }
    return { safe: true };
  } catch {
    return { safe: false, error: "Invalid URL format" };
  }
}

const MAX_URL_LENGTH = 2000;

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Bookmarks'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } }
});
bookmarksRoutes.openapi(healthRoute, (c) => c.json({ module: "bookmarks", status: "ok" }, 200));

const listBookmarksRoute = createRoute({
  method: 'get', path: '/', tags: ['Bookmarks'],
  description: 'List or search bookmarks',
  responses: { 200: { content: { 'application/json': { schema: z.object({ bookmarks: z.array(z.any()), total: z.number() }) } }, description: 'Bookmarks list' } }
});
bookmarksRoutes.openapi(listBookmarksRoute, async (c) => {
  const q = c.req.query("q")?.toLowerCase();
  if (q) {
    const pattern = `%${q}%`;
    const rows = await sql`SELECT * FROM bookmarks WHERE title LIKE ${pattern} OR url LIKE ${pattern} OR summary LIKE ${pattern} OR tags LIKE ${pattern} ORDER BY created_at DESC`;
    const bookmarks = rows.map(parseBookmark);
    return c.json({ bookmarks, total: bookmarks.length }, 200);
  }
  const rows = await sql`SELECT * FROM bookmarks ORDER BY created_at DESC`;
  const bookmarks = rows.map(parseBookmark);
  return c.json({ bookmarks, total: bookmarks.length }, 200);
});

const createBookmarkRoute = createRoute({
  method: 'post', path: '/', tags: ['Bookmarks'],
  description: 'Create a bookmark (auto-fetches title and tags)',
  request: { body: { content: { 'application/json': { schema: z.object({ url: z.string(), tags: z.array(z.string()).optional() }) } } } },
  responses: {
    201: { content: { 'application/json': { schema: z.object({ id: z.string(), url: z.string(), title: z.string(), summary: z.string(), tags: z.array(z.string()), createdAt: z.string() }) } }, description: 'Bookmark created' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
bookmarksRoutes.openapi(createBookmarkRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.url) return c.json({ error: "url is required" } as any, 400);

  if (body.url.length > MAX_URL_LENGTH) {
    return c.json({ error: "URL must be 2000 characters or fewer" } as any, 400);
  }

  const urlCheck = isUrlSafe(body.url);
  if (!urlCheck.safe) {
    return c.json({ error: urlCheck.error } as any, 400);
  }

  let title = body.url;
  let summary = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(body.url, { signal: controller.signal });
    clearTimeout(timeout);
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].trim();
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
    );
    if (descMatch) summary = descMatch[1].trim();
  } catch {
    // Keep URL as title if fetch fails
  }

  const autoTags = new Set<string>(body.tags || []);
  try {
    const urlObj = new URL(body.url);
    autoTags.add(urlObj.hostname.replace("www.", ""));
  } catch {
    // skip
  }

  const textForTags = `${title} ${summary}`.toLowerCase();
  const stopWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","and","but","or","nor","not","so","very","just","about","up","its","it","this","that","these","those","i","me","my","we","our","you","your","he","she","they","them","his","her","their","what","which","who","how","all","each","every","both","few","more","most","other","some","such","no","only","own","same"]);
  const words = textForTags.replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const wordFreq: Record<string, number> = {};
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
  const topKeywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  for (const kw of topKeywords) autoTags.add(kw);

  const id = crypto.randomUUID();
  const tags = JSON.stringify([...autoTags]);
  await sql`INSERT INTO bookmarks (id, url, title, summary, tags, favicon) VALUES (${id}, ${body.url}, ${title}, ${summary}, ${tags}, ${null})`;

  return c.json({ id, url: body.url, title, summary, tags: [...autoTags], createdAt: new Date().toISOString() }, 201);
});

const updateBookmarkRoute = createRoute({
  method: 'put', path: '/{id}', tags: ['Bookmarks'],
  description: 'Update a bookmark',
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ title: z.string().optional(), tags: z.array(z.string()).optional() }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ id: z.string(), title: z.string(), tags: z.array(z.string()) }) } }, description: 'Bookmark updated' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
bookmarksRoutes.openapi(updateBookmarkRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM bookmarks WHERE id = ${id}`;
  if (!existing) return c.json({ error: "Bookmark not found" } as any, 404);
  const body = c.req.valid('json');
  const parsed = parseBookmark(existing);
  const title = body.title ?? parsed.title;
  const tags = JSON.stringify(body.tags ?? parsed.tags);
  await sql`UPDATE bookmarks SET title = ${title}, tags = ${tags} WHERE id = ${id}`;
  return c.json({ id, title, tags: JSON.parse(tags) }, 200);
});

const deleteBookmarkRoute = createRoute({
  method: 'delete', path: '/{id}', tags: ['Bookmarks'],
  description: 'Delete a bookmark',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ deleted: z.string() }) } }, description: 'Bookmark deleted' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' },
  }
});
bookmarksRoutes.openapi(deleteBookmarkRoute, async (c) => {
  const id = c.req.valid('param').id;
  const [existing] = await sql`SELECT * FROM bookmarks WHERE id = ${id}`;
  if (!existing) return c.json({ error: "Bookmark not found" } as any, 404);
  await sql`DELETE FROM bookmarks WHERE id = ${id}`;
  return c.json({ deleted: id }, 200);
});

const exportBookmarksRoute = createRoute({
  method: 'get', path: '/export', tags: ['Bookmarks'],
  description: 'Export all bookmarks as JSON',
  responses: { 200: { content: { 'application/json': { schema: z.object({ bookmarks: z.array(z.any()), exportedAt: z.string() }) } }, description: 'Exported bookmarks' } }
});
bookmarksRoutes.openapi(exportBookmarksRoute, async (c) => {
  const rows = await sql`SELECT * FROM bookmarks ORDER BY created_at DESC`;
  const bookmarks = rows.map(parseBookmark);
  return c.json({ bookmarks, exportedAt: new Date().toISOString() }, 200);
});

const importBookmarksRoute = createRoute({
  method: 'post', path: '/import', tags: ['Bookmarks'],
  description: 'Import bookmarks from JSON',
  request: { body: { content: { 'application/json': { schema: z.object({ bookmarks: z.array(z.object({ url: z.string(), title: z.string().optional(), summary: z.string().optional(), tags: z.array(z.string()).optional() })) }) } } } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ imported: z.number() }) } }, description: 'Import result' },
    400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' },
  }
});
bookmarksRoutes.openapi(importBookmarksRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.bookmarks?.length) return c.json({ error: "bookmarks array is required" } as any, 400);
  let imported = 0;
  for (const b of body.bookmarks) {
    if (!b.url) continue;
    if (b.url.length > MAX_URL_LENGTH || !isUrlSafe(b.url).safe) continue;
    const id = crypto.randomUUID();
    const tags = JSON.stringify(b.tags || []);
    await sql`INSERT INTO bookmarks (id, url, title, summary, tags, favicon) VALUES (${id}, ${b.url}, ${b.title || b.url}, ${b.summary || ""}, ${tags}, ${null})`;
    imported++;
  }
  return c.json({ imported }, 200);
});

const tagsRoute = createRoute({
  method: 'get', path: '/tags', tags: ['Bookmarks'],
  description: 'Get tag counts',
  responses: { 200: { content: { 'application/json': { schema: z.object({ tags: z.record(z.string(), z.number()) }) } }, description: 'Tag counts' } }
});
bookmarksRoutes.openapi(tagsRoute, async (c) => {
  const rows = await sql`SELECT tags FROM bookmarks` as any[];
  const tagCounts: Record<string, number> = {};
  for (const row of rows) {
    const tags = JSON.parse(row.tags || "[]");
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  return c.json({ tags: tagCounts }, 200);
});
