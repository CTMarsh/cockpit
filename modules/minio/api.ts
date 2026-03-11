import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { s3Available, listBuckets, listPrefixes, getObject, putObject, deleteObject, createBucket, deleteBucket } from "../s3-client";

export const minioRoutes = new OpenAPIHono();

const BUCKET_NAME_RE = /^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$/;
function validateObjectKey(key: string): boolean { return !!key && !key.includes("..") && !key.includes("\0") && !/[\x00-\x1f]/.test(key); }

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp", pdf: "application/pdf", json: "application/json", xml: "application/xml", txt: "text/plain", html: "text/html", css: "text/css", js: "application/javascript", md: "text/markdown", csv: "text/csv", yaml: "text/yaml", yml: "text/yaml", gz: "application/gzip", zip: "application/zip", tar: "application/x-tar" };
  return types[ext] || "application/octet-stream";
}

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['MinIO'], responses: { 200: { content: { 'application/json': { schema: z.object({ available: z.boolean() }) } }, description: 'Availability' } } });
minioRoutes.openapi(healthRoute, (c) => c.json({ available: s3Available() }, 200));

const listBucketsRoute = createRoute({ method: 'get', path: '/buckets', tags: ['MinIO'], description: 'List all S3 buckets', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Bucket list' } } });
minioRoutes.openapi(listBucketsRoute, async (c) => {
  if (!s3Available()) return c.json({ available: false, buckets: [] }, 200);
  const buckets = await listBuckets();
  return c.json({ available: true, buckets }, 200);
});

const createBucketRoute = createRoute({ method: 'post', path: '/buckets', tags: ['MinIO'], request: { body: { content: { 'application/json': { schema: z.object({ name: z.string() }) } } } }, responses: { 201: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Bucket created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Creation failed' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'S3 not configured' } } });
minioRoutes.openapi(createBucketRoute, async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" } as any, 503);
  const { name } = c.req.valid('json');
  if (!name || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) return c.json({ error: "Invalid bucket name (3-63 chars, lowercase, alphanumeric, dots, hyphens)" } as any, 400);
  const ok = await createBucket(name);
  if (!ok) return c.json({ error: "Failed to create bucket" } as any, 502);
  return c.json({ ok: true }, 201);
});

const deleteBucketRoute = createRoute({ method: 'delete', path: '/buckets/{name}', tags: ['MinIO'], request: { params: z.object({ name: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Bucket deleted' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'S3 not configured' } } });
minioRoutes.openapi(deleteBucketRoute, async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" } as any, 503);
  const name = c.req.valid('param').name;
  if (!BUCKET_NAME_RE.test(name)) return c.json({ error: "Invalid bucket name" } as any, 400);
  const ok = await deleteBucket(name);
  if (!ok) return c.json({ error: "Failed to delete bucket (must be empty)" } as any, 400);
  return c.json({ ok: true }, 200);
});

const listObjectsRoute = createRoute({ method: 'get', path: '/objects/{bucket}', tags: ['MinIO'], description: 'List objects in a bucket', request: { params: z.object({ bucket: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Object list' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
minioRoutes.openapi(listObjectsRoute, async (c) => {
  if (!s3Available()) return c.json({ available: false, prefixes: [], objects: [] }, 200);
  const bucket = c.req.valid('param').bucket;
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" } as any, 400);
  const prefix = c.req.query("prefix") || "";
  const result = await listPrefixes(bucket, prefix);
  return c.json({ available: true, bucket, prefix, ...result } as any, 200);
});

// Download/Upload/Delete — use binary streams, kept as regular routes
minioRoutes.get("/download/:bucket/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const bucket = c.req.param("bucket"); const key = c.req.param("key");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" }, 400);
  const res = await getObject(bucket, key);
  if (!res.ok) return c.json({ error: "Object not found" }, 404);
  const rawFilename = key.split("/").pop() || key;
  const safeFilename = rawFilename.replace(/["\\\x00-\x1f\x7f]/g, "_");
  return new Response(res.body, { headers: { "Content-Type": guessContentType(rawFilename), "Content-Disposition": `attachment; filename="${safeFilename}"` } });
});

minioRoutes.put("/upload/:bucket/:key{.+}", async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" }, 503);
  const bucket = c.req.param("bucket"); const key = c.req.param("key");
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" }, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" }, 400);
  const body = new Uint8Array(await c.req.arrayBuffer());
  const ct = c.req.header("content-type") || "application/octet-stream";
  const ok = await putObject(bucket, key, body, ct);
  if (!ok) return c.json({ error: "Upload failed" }, 502);
  return c.json({ ok: true, bucket, key, size: body.length });
});

const deleteObjectRoute = createRoute({ method: 'delete', path: '/objects/{bucket}/{key}', tags: ['MinIO'], description: 'Delete an object', request: { params: z.object({ bucket: z.string(), key: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } }, description: 'Object deleted' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' }, 502: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Delete failed' }, 503: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'S3 not configured' } } });
minioRoutes.openapi(deleteObjectRoute, async (c) => {
  if (!s3Available()) return c.json({ error: "S3 not configured" } as any, 503);
  const { bucket, key } = c.req.valid('param');
  if (!BUCKET_NAME_RE.test(bucket)) return c.json({ error: "Invalid bucket name" } as any, 400);
  if (!validateObjectKey(key)) return c.json({ error: "Invalid object key" } as any, 400);
  const ok = await deleteObject(bucket, key);
  if (!ok) return c.json({ error: "Delete failed" } as any, 502);
  return c.json({ ok: true }, 200);
});
