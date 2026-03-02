import { Hono } from "hono";
import { db } from "../../apps/api/src/db";

export const bookmarksRoutes = new Hono();

const stmts = {
  getAll: db.query("SELECT * FROM bookmarks ORDER BY created_at DESC"),
  search: db.query(
    "SELECT * FROM bookmarks WHERE title LIKE ?1 OR url LIKE ?1 OR summary LIKE ?1 OR tags LIKE ?1 ORDER BY created_at DESC"
  ),
  getById: db.query("SELECT * FROM bookmarks WHERE id = ?"),
  insert: db.query(
    "INSERT INTO bookmarks (id, url, title, summary, tags, favicon) VALUES (?, ?, ?, ?, ?, ?)"
  ),
  delete: db.query("DELETE FROM bookmarks WHERE id = ?"),
  update: db.query("UPDATE bookmarks SET title = ?, tags = ? WHERE id = ?"),
  getTags: db.query("SELECT tags FROM bookmarks"),
};

function parseBookmark(row: any) {
  return { ...row, tags: JSON.parse(row.tags || "[]") };
}

bookmarksRoutes.get("/health", (c) => c.json({ module: "bookmarks", status: "ok" }));

bookmarksRoutes.get("/", (c) => {
  const q = c.req.query("q")?.toLowerCase();
  if (q) {
    const pattern = `%${q}%`;
    const rows = stmts.search.all(pattern);
    const bookmarks = rows.map(parseBookmark);
    return c.json({ bookmarks, total: bookmarks.length });
  }
  const rows = stmts.getAll.all();
  const bookmarks = rows.map(parseBookmark);
  return c.json({ bookmarks, total: bookmarks.length });
});

bookmarksRoutes.post("/", async (c) => {
  const body = await c.req.json<{ url: string; tags?: string[] }>();
  if (!body.url) return c.json({ error: "url is required" }, 400);

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

  // AI auto-tagging: extract keywords from title and summary
  const textForTags = `${title} ${summary}`.toLowerCase();
  const stopWords = new Set(["the","a","an","is","are","was","were","be","been","being","have","has","had","do","does","did","will","would","could","should","may","might","shall","can","need","dare","ought","used","to","of","in","for","on","with","at","by","from","as","into","through","during","before","after","above","below","between","out","off","over","under","again","further","then","once","and","but","or","nor","not","so","very","just","about","up","its","it","this","that","these","those","i","me","my","we","our","you","your","he","she","they","them","his","her","their","what","which","who","how","all","each","every","both","few","more","most","other","some","such","no","only","own","same"]);
  const words = textForTags.replace(/[^a-z0-9\s-]/g, "").split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const wordFreq: Record<string, number> = {};
  for (const w of words) wordFreq[w] = (wordFreq[w] || 0) + 1;
  const topKeywords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
  for (const kw of topKeywords) autoTags.add(kw);

  const id = crypto.randomUUID();
  const tags = JSON.stringify([...autoTags]);
  stmts.insert.run(id, body.url, title, summary, tags, null);

  return c.json({ id, url: body.url, title, summary, tags: [...autoTags], createdAt: new Date().toISOString() }, 201);
});

bookmarksRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = stmts.getById.get(id);
  if (!existing) return c.json({ error: "Bookmark not found" }, 404);
  const body = await c.req.json<{ title?: string; tags?: string[] }>();
  const parsed = parseBookmark(existing);
  const title = body.title ?? parsed.title;
  const tags = JSON.stringify(body.tags ?? parsed.tags);
  stmts.update.run(title, tags, id);
  return c.json({ id, title, tags: JSON.parse(tags) });
});

bookmarksRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const existing = stmts.getById.get(id);
  if (!existing) return c.json({ error: "Bookmark not found" }, 404);
  stmts.delete.run(id);
  return c.json({ deleted: id });
});

bookmarksRoutes.get("/tags", (c) => {
  const rows = stmts.getTags.all() as any[];
  const tagCounts: Record<string, number> = {};
  for (const row of rows) {
    const tags = JSON.parse(row.tags || "[]");
    for (const t of tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  return c.json({ tags: tagCounts });
});
