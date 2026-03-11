import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createHash } from "crypto";
import { readdir, stat, readFile } from "fs/promises";
import { join, resolve, normalize } from "path";

export const dedupRoutes = new OpenAPIHono();

// ── Path traversal prevention ──
// Allowed base directories for scanning (configurable via env)
const ALLOWED_SCAN_DIRS = (process.env.DEDUP_ALLOWED_DIRS || "/data,/home,/tmp").split(",").map(d => d.trim());
const MAX_PATH_LENGTH = 500;

function isPathAllowed(requestedPath: string): { allowed: boolean; resolved: string; error?: string } {
  if (!requestedPath || requestedPath.length > MAX_PATH_LENGTH) {
    return { allowed: false, resolved: "", error: "Path too long or empty" };
  }

  // Block path traversal attempts
  if (requestedPath.includes("..")) {
    return { allowed: false, resolved: "", error: "Path traversal (..) is not allowed" };
  }

  const resolved = resolve(normalize(requestedPath));

  // Must be under an allowed directory
  const isAllowed = ALLOWED_SCAN_DIRS.some(dir => resolved.startsWith(resolve(dir)));
  if (!isAllowed) {
    return { allowed: false, resolved, error: `Path must be under one of: ${ALLOWED_SCAN_DIRS.join(", ")}` };
  }

  return { allowed: true, resolved };
}

interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

interface ScanResult {
  id: string;
  directory: string;
  status: "scanning" | "complete" | "error";
  totalFiles: number;
  duplicateGroups: DuplicateGroup[];
  reclaimableBytes: number;
  startedAt: string;
  completedAt?: string;
}

const scans: Map<string, ScanResult> = new Map();

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Dedup'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
dedupRoutes.openapi(healthRoute, (c) => c.json({ module: "dedup", status: "ok" }, 200));

// Report allowed scan directories
const allowedDirsRoute = createRoute({ method: 'get', path: '/allowed-dirs', tags: ['Dedup'], description: 'List allowed scan directories', responses: { 200: { content: { 'application/json': { schema: z.object({ directories: z.array(z.string()) }) } }, description: 'Allowed directories' } } });
dedupRoutes.openapi(allowedDirsRoute, (c) => c.json({ directories: ALLOWED_SCAN_DIRS }, 200));

async function walkDir(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common system/hidden dirs
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        await walkDir(fullPath, files);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Permission denied or other errors — skip
  }
  return files;
}

async function hashFile(path: string): Promise<string> {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex");
}

// Start a new scan
const scanRoute = createRoute({ method: 'post', path: '/scan', tags: ['Dedup'], description: 'Start a duplicate file scan', request: { body: { content: { 'application/json': { schema: z.object({ directory: z.string() }) } } } }, responses: { 202: { content: { 'application/json': { schema: z.object({ id: z.string(), status: z.string() }) } }, description: 'Scan started' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
dedupRoutes.openapi(scanRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.directory) return c.json({ error: "directory is required" } as any, 400);

  const pathCheck = isPathAllowed(body.directory);
  if (!pathCheck.allowed) {
    return c.json({ error: pathCheck.error } as any, 400);
  }

  const id = crypto.randomUUID();
  const scan: ScanResult = {
    id,
    directory: pathCheck.resolved,
    status: "scanning",
    totalFiles: 0,
    duplicateGroups: [],
    reclaimableBytes: 0,
    startedAt: new Date().toISOString(),
  };
  scans.set(id, scan);

  // Run scan async
  (async () => {
    try {
      const files = await walkDir(pathCheck.resolved);
      scan.totalFiles = files.length;

      // Hash all files and group by hash
      const hashMap: Map<string, { path: string; size: number }[]> = new Map();
      for (const file of files) {
        try {
          const fileInfo = await stat(file);
          // Skip files over 100MB to avoid memory issues
          if (fileInfo.size > 100 * 1024 * 1024) continue;
          if (fileInfo.size === 0) continue;
          const hash = await hashFile(file);
          const existing = hashMap.get(hash) || [];
          existing.push({ path: file, size: fileInfo.size });
          hashMap.set(hash, existing);
        } catch {
          // Skip unreadable files
        }
      }

      // Find groups with more than one file
      for (const [hash, group] of hashMap) {
        if (group.length > 1) {
          const dupeGroup: DuplicateGroup = {
            hash,
            size: group[0].size,
            files: group.map((f) => f.path),
          };
          scan.duplicateGroups.push(dupeGroup);
          // Reclaimable = size * (copies - 1)
          scan.reclaimableBytes += dupeGroup.size * (group.length - 1);
        }
      }

      scan.status = "complete";
      scan.completedAt = new Date().toISOString();
    } catch {
      scan.status = "error";
    }
  })();

  return c.json({ id, status: "scanning" }, 202);
});

// Get scan status/results
const scanDetailRoute = createRoute({ method: 'get', path: '/scan/{id}', tags: ['Dedup'], description: 'Get scan status and results', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Scan result' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Not found' } } });
dedupRoutes.openapi(scanDetailRoute, (c) => {
  const scan = scans.get(c.req.valid('param').id);
  if (!scan) return c.json({ error: "Scan not found" } as any, 404);
  return c.json(scan as any, 200);
});

// List all scans
const scansRoute = createRoute({ method: 'get', path: '/scans', tags: ['Dedup'], description: 'List all scans', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Scan list' } } });
dedupRoutes.openapi(scansRoute, (c) => {
  return c.json({ scans: [...scans.values()] }, 200);
});

// Delete specific duplicate files (requires explicit confirmation via body)
const deleteRoute = createRoute({ method: 'post', path: '/delete', tags: ['Dedup'], description: 'Delete duplicate files', request: { body: { content: { 'application/json': { schema: z.object({ files: z.array(z.string()), confirmed: z.boolean() }) } } } }, responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Delete results' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
dedupRoutes.openapi(deleteRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.confirmed) {
    return c.json({ error: "Must set confirmed: true to delete files" } as any, 400);
  }
  if (!body.files || body.files.length === 0) {
    return c.json({ error: "files array is required" } as any, 400);
  }

  const { unlink } = await import("fs/promises");
  const results: { file: string; deleted: boolean; error?: string }[] = [];
  for (const file of body.files) {
    // Validate each file path is within allowed directories
    const fileCheck = isPathAllowed(file);
    if (!fileCheck.allowed) {
      results.push({ file, deleted: false, error: fileCheck.error || "Path not allowed" });
      continue;
    }
    try {
      await unlink(fileCheck.resolved);
      results.push({ file, deleted: true });
    } catch (err: any) {
      results.push({ file, deleted: false, error: err.message });
    }
  }

  return c.json({
    results,
    deleted: results.filter((r) => r.deleted).length,
    failed: results.filter((r) => !r.deleted).length,
  } as any, 200);
});
