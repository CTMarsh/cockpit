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

  const id = crypto.randomUUID();
  const tags = JSON.stringify([...autoTags]);
  stmts.insert.run(id, body.url, title, summary, tags, null);

  return c.json({ id, url: body.url, title, summary, tags: [...autoTags], createdAt: new Date().toISOString() }, 201);
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
