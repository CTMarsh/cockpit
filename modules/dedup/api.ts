import { Hono } from "hono";
import { createHash } from "crypto";
import { readdir, stat, readFile } from "fs/promises";
import { join } from "path";

export const dedupRoutes = new Hono();

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

dedupRoutes.get("/health", (c) => c.json({ module: "dedup", status: "ok" }));

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
dedupRoutes.post("/scan", async (c) => {
  const body = await c.req.json<{ directory: string }>();
  if (!body.directory) return c.json({ error: "directory is required" }, 400);

  const id = crypto.randomUUID();
  const scan: ScanResult = {
    id,
    directory: body.directory,
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
      const files = await walkDir(body.directory);
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
dedupRoutes.get("/scan/:id", (c) => {
  const scan = scans.get(c.req.param("id"));
  if (!scan) return c.json({ error: "Scan not found" }, 404);
  return c.json(scan);
});

// List all scans
dedupRoutes.get("/scans", (c) => {
  return c.json({ scans: [...scans.values()] });
});

// Delete specific duplicate files (requires explicit confirmation via body)
dedupRoutes.post("/delete", async (c) => {
  const body = await c.req.json<{ files: string[]; confirmed: boolean }>();
  if (!body.confirmed) {
    return c.json({ error: "Must set confirmed: true to delete files" }, 400);
  }
  if (!body.files || body.files.length === 0) {
    return c.json({ error: "files array is required" }, 400);
  }

  const results: { file: string; deleted: boolean; error?: string }[] = [];
  for (const file of body.files) {
    try {
      const { unlink } = await import("fs/promises");
      await unlink(file);
      results.push({ file, deleted: true });
    } catch (err: any) {
      results.push({ file, deleted: false, error: err.message });
    }
  }

  return c.json({
    results,
    deleted: results.filter((r) => r.deleted).length,
    failed: results.filter((r) => !r.deleted).length,
  });
});
