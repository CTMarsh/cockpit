import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { s3Available, listObjects, putObject } from "../s3-client";
import { gzipSync } from "bun";

export const backupRoutes = new OpenAPIHono();

const BACKUP_BUCKET = process.env.BACKUP_BUCKET || "cockpit-backups";
const DB_PATH = process.env.DB_PATH || "./data/cockpit.db";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

const healthRoute = createRoute({
  method: 'get', path: '/health', tags: ['Backup'],
  responses: { 200: { content: { 'application/json': { schema: z.object({ available: z.boolean(), bucket: z.string() }) } }, description: 'Module health' } }
});
backupRoutes.openapi(healthRoute, (c) => c.json({ available: s3Available(), bucket: BACKUP_BUCKET }, 200));

const listRoute = createRoute({
  method: 'get', path: '/list', tags: ['Backup'],
  description: 'List all backups',
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Backup list' } }
});
backupRoutes.openapi(listRoute, async (c) => {
  if (!s3Available()) return c.json({ available: false, backups: [] }, 200);
  const objects = await listObjects(BACKUP_BUCKET, "backups/");
  const backups = objects.map((o) => ({ key: o.key, name: o.key.replace("backups/", ""), size: o.size, sizeHuman: formatBytes(o.size), lastModified: o.lastModified }));
  backups.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return c.json({ available: true, backups } as any, 200);
});

const triggerRoute = createRoute({
  method: 'post', path: '/trigger', tags: ['Backup'],
  description: 'Create a manual backup',
  responses: {
    200: { content: { 'application/json': { schema: z.any() } }, description: 'Backup created' },
    404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'DB not found' },
    500: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Error' },
    502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Upload failed' },
    503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'S3 not configured' },
  }
});
backupRoutes.openapi(triggerRoute, async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" } as any, 503);
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `backups/cockpit-${timestamp}.db.gz`;
    const file = Bun.file(DB_PATH);
    if (!(await file.exists())) return c.json({ error: "Database file not found" } as any, 404);
    const dbBytes = new Uint8Array(await file.arrayBuffer());
    const compressed = gzipSync(dbBytes);
    const ok = await putObject(BACKUP_BUCKET, key, compressed, "application/gzip");
    if (!ok) return c.json({ error: "Failed to upload backup to S3" } as any, 502);
    return c.json({ ok: true, key, originalSize: dbBytes.length, compressedSize: compressed.length, timestamp: new Date().toISOString() }, 200);
  } catch (e: any) {
    return c.json({ error: e.message || "Backup failed" } as any, 500);
  }
});

// Download route — returns binary, kept as regular route
backupRoutes.get("/download/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const key = c.req.param("key");
  if (!key.startsWith("backups/") || key.includes("..") || key.includes("\0")) return c.json({ error: "Invalid backup key" }, 400);
  const { getObject } = await import("../s3-client");
  const res = await getObject(BACKUP_BUCKET, key);
  if (!res.ok) return c.json({ error: "Backup not found" }, 404);
  return new Response(res.body, { headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${key.split("/").pop()}"` } });
});
