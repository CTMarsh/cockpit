import { Hono } from "hono";
import { s3Available, listObjects, putObject } from "../s3-client";
import { gzipSync } from "bun";

export const backupRoutes = new Hono();

const BACKUP_BUCKET = process.env.BACKUP_BUCKET || "cockpit-backups";
const DB_PATH = process.env.DB_PATH || "./data/cockpit.db";

// ── GET /health — module availability ──
backupRoutes.get("/health", (c) => {
  return c.json({ available: s3Available(), bucket: BACKUP_BUCKET });
});

// ── GET /list — list all backups ──
backupRoutes.get("/list", async (c) => {
  if (!s3Available()) return c.json({ available: false, backups: [] });
  const objects = await listObjects(BACKUP_BUCKET, "backups/");
  const backups = objects.map((o) => ({
    key: o.key,
    name: o.key.replace("backups/", ""),
    size: o.size,
    sizeHuman: formatBytes(o.size),
    lastModified: o.lastModified,
  }));
  backups.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return c.json({ available: true, backups });
});

// ── POST /trigger — create a manual backup ──
backupRoutes.post("/trigger", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `backups/cockpit-${timestamp}.db.gz`;

    // Read SQLite DB file
    const file = Bun.file(DB_PATH);
    if (!(await file.exists())) {
      return c.json({ error: "Database file not found" }, 404);
    }
    const dbBytes = new Uint8Array(await file.arrayBuffer());

    // Gzip compress
    const compressed = gzipSync(dbBytes);

    // Upload to S3
    const ok = await putObject(BACKUP_BUCKET, key, compressed, "application/gzip");
    if (!ok) return c.json({ error: "Failed to upload backup to S3" }, 502);

    return c.json({
      ok: true,
      key,
      originalSize: dbBytes.length,
      compressedSize: compressed.length,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return c.json({ error: e.message || "Backup failed" }, 500);
  }
});

// ── GET /download/:key — download a backup (returns gzipped file) ──
backupRoutes.get("/download/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const key = c.req.param("key");

  // Prevent path traversal — key must start with backups/ and contain no ..
  if (!key.startsWith("backups/") || key.includes("..") || key.includes("\0")) {
    return c.json({ error: "Invalid backup key" }, 400);
  }

  const { getObject } = await import("../s3-client");
  const res = await getObject(BACKUP_BUCKET, key);
  if (!res.ok) return c.json({ error: "Backup not found" }, 404);
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`,
    },
  });
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}
