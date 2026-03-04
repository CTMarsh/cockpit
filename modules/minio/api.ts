import { Hono } from "hono";
import {
  s3Available, listBuckets, listPrefixes, getObject,
  putObject, deleteObject, createBucket, deleteBucket,
} from "../s3-client";

export const minioRoutes = new Hono();

// S3 bucket name validation (3-63 chars, lowercase, numbers, hyphens, dots)
const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/;
// Object key: no .., no null bytes, no control chars
function validateObjectKey(key: string): boolean {
  return !!key && !key.includes("..") && !key.includes("\0") && !/[\x00-\x1f]/.test(key);
}

// ── GET /health — availability check ──
minioRoutes.get("/health", (c) => {
  return c.json({ available: s3Available() });
});

// ── GET /buckets — list all buckets ──
minioRoutes.get("/buckets", async (c) => {
  if (!s3Available()) return c.json({ available: false, buckets: [] });
  const buckets = await listBuckets();
  return c.json({ available: true, buckets });
});

// ── POST /buckets — create a bucket ──
minioRoutes.post("/buckets", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const { name } = await c.req.json();
  if (!name || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) {
    return c.json({ error: "Invalid bucket name (3-63 chars, lowercase, alphanumeric, dots, hyphens)" }, 400);
  }
  const ok = await createBucket(name);
  if (!ok) return c.json({ error: "Failed to create bucket" }, 502);
  return c.json({ ok: true }, 201);
});

// ── DELETE /buckets/:name — delete a bucket ──
minioRoutes.delete("/buckets/:name", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const name = c.req.param("name");
  if (!BUCKET_NAME_RE.test(name)) return c.json({ error: "Invalid bucket name" }, 400);
  const ok = await deleteBucket(name);
  if (!ok) return c.json({ error: "Failed to delete bucket (must be empty)" }, 400);
  return c.json({ ok: true });
});

// ── GET /objects/:bucket — list objects (with prefix for folder navigation) ──
minioRoutes.get("/objects/:bucket", async (c) => {
  if (!s3Available()) return c.json({ available: false, prefixes: [], objects: [] });
  const bucket = c.req.param("bucket");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  const prefix = c.req.query("prefix") || "";
  const result = await listPrefixes(bucket, prefix);
  return c.json({ available: true, bucket, prefix, ...result });
});

// ── GET /download/:bucket/:key{.+} — download a file ──
minioRoutes.get("/download/:bucket/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" }, 400);

  const res = await getObject(bucket, key);
  if (!res.ok) return c.json({ error: "Object not found" }, 404);

  // Sanitize filename for Content-Disposition header (strip control chars and quotes)
  const rawFilename = key.split("/").pop() || key;
  const safeFilename = rawFilename.replace(/["\\\x00-\x1f\x7f]/g, "_");
  const ct = guessContentType(rawFilename);
  return new Response(res.body, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
});

// ── PUT /upload/:bucket/:key{.+} — upload a file ──
minioRoutes.put("/upload/:bucket/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" }, 400);
  const body = new Uint8Array(await c.req.arrayBuffer());
  const ct = c.req.header("content-type") || "application/octet-stream";
  const ok = await putObject(bucket, key, body, ct);
  if (!ok) return c.json({ error: "Upload failed" }, 502);
  return c.json({ ok: true, bucket, key, size: body.length });
});

// ── DELETE /objects/:bucket/:key{.+} — delete an object ──
minioRoutes.delete("/objects/:bucket/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const bucket = c.req.param("bucket");
  const key = c.req.param("key");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" }, 400);
  const ok = await deleteObject(bucket, key);
  if (!ok) return c.json({ error: "Delete failed" }, 502);
  return c.json({ ok: true });
});

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    svg: "image/svg+xml", webp: "image/webp", pdf: "application/pdf",
    json: "application/json", xml: "application/xml", txt: "text/plain",
    html: "text/html", css: "text/css", js: "application/javascript",
    md: "text/markdown", csv: "text/csv", yaml: "text/yaml", yml: "text/yaml",
    gz: "application/gzip", zip: "application/zip", tar: "application/x-tar",
  };
  return types[ext] || "application/octet-stream";
}
