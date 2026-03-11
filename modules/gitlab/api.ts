import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

export const gitlabRoutes = new OpenAPIHono();

const GITLAB_URL = process.env.GITLAB_URL || "";
const GITLAB_TOKEN = process.env.GITLAB_TOKEN || "";

async function gitlabApi(path: string, options: RequestInit = {}): Promise<Response> {
  if (!GITLAB_URL || !GITLAB_TOKEN) throw new Error("GitLab not configured. Set GITLAB_URL and GITLAB_TOKEN env vars.");
  return fetch(`${GITLAB_URL}/api/v4${path}`, { ...options, headers: { "PRIVATE-TOKEN": GITLAB_TOKEN, "Content-Type": "application/json", ...options.headers } });
}

async function gitlabGet(c: any, path: string) {
  const url = new URL(c.req.url); const params = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) params.set(k, v);
  const qs = params.toString(); const sep = path.includes("?") ? "&" : "?";
  const fullPath = qs ? `${path}${sep}${qs}` : path;
  const res = await gitlabApi(fullPath);
  if (!res.ok) { const text = await res.text(); throw new Error(`GitLab API ${res.status}: ${text.slice(0, 300)}`); }
  const data = await res.json();
  const totalPages = parseInt(res.headers.get("x-total-pages") || "1");
  const nextPage = res.headers.get("x-next-page") || null;
  const total = parseInt(res.headers.get("x-total") || "0");
  return c.json({ items: data, totalPages, nextPage, total }, 200);
}

async function gitlabMutate(c: any, path: string, method: string) {
  let body: any = undefined;
  try { body = await c.req.json(); } catch { /* No body */ }
  const res = await gitlabApi(path, { method, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const text = await res.text(); throw new Error(`GitLab API ${res.status}: ${text.slice(0, 300)}`); }
  return c.json(await res.json(), 200);
}

function validateId(value: string): number { const id = parseInt(value); if (isNaN(id) || id < 1) throw new Error("Invalid ID"); return id; }

const statusRoute = createRoute({ method: 'get', path: '/status', tags: ['GitLab'], description: 'Check GitLab connection', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Connection status' } } });
gitlabRoutes.openapi(statusRoute, async (c) => {
  if (!GITLAB_URL || !GITLAB_TOKEN) return c.json({ configured: false, message: "Set GITLAB_URL and GITLAB_TOKEN in .env" }, 200);
  try { const res = await gitlabApi("/version"); if (!res.ok) throw new Error(`HTTP ${res.status}`); const data = await res.json(); return c.json({ configured: true, url: GITLAB_URL, connected: true, version: data.version }, 200); }
  catch (e: any) { return c.json({ configured: true, url: GITLAB_URL, connected: false, error: e.message }, 200); }
});

// All GitLab proxy routes — kept as regular routes since they proxy varying response shapes
gitlabRoutes.get("/projects", async (c) => { try { return await gitlabGet(c, "/projects?membership=true&order_by=last_activity_at&sort=desc"); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id", async (c) => { try { const id = validateId(c.req.param("id")); const res = await gitlabApi(`/projects/${id}?statistics=true`); if (!res.ok) throw new Error(`HTTP ${res.status}`); return c.json(await res.json()); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/issues", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/issues`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.post("/projects/:id/issues", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/issues`, "POST"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.put("/projects/:id/issues/:iid", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/issues/${validateId(c.req.param("iid"))}`, "PUT"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/issues/:iid/notes", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/issues/${validateId(c.req.param("iid"))}/notes`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.post("/projects/:id/issues/:iid/notes", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/issues/${validateId(c.req.param("iid"))}/notes`, "POST"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/merge_requests", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/merge_requests`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/merge_requests/:iid", async (c) => { try { const res = await gitlabApi(`/projects/${validateId(c.req.param("id"))}/merge_requests/${validateId(c.req.param("iid"))}`); if (!res.ok) throw new Error(`HTTP ${res.status}`); return c.json(await res.json()); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/merge_requests/:iid/changes", async (c) => { try { const id = validateId(c.req.param("id")); const iid = validateId(c.req.param("iid")); const res = await gitlabApi(`/projects/${id}/merge_requests/${iid}/changes`); if (!res.ok) throw new Error(`HTTP ${res.status}`); const data = await res.json(); const changes = (data.changes || []).map((ch: any) => ({ oldPath: ch.old_path, newPath: ch.new_path, newFile: ch.new_file, renamedFile: ch.renamed_file, deletedFile: ch.deleted_file, diff: ch.diff?.slice(0, 5000) || "" })); return c.json({ changes, changesCount: data.changes_count }); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.post("/projects/:id/merge_requests/:iid/approve", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/merge_requests/${validateId(c.req.param("iid"))}/approve`, "POST"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.put("/projects/:id/merge_requests/:iid/merge", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/merge_requests/${validateId(c.req.param("iid"))}/merge`, "PUT"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/pipelines", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/pipelines`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/pipelines/:pid/jobs", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/pipelines/${validateId(c.req.param("pid"))}/jobs`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.post("/projects/:id/jobs/:jid/retry", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/jobs/${validateId(c.req.param("jid"))}/retry`, "POST"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.post("/projects/:id/jobs/:jid/cancel", async (c) => { try { return await gitlabMutate(c, `/projects/${validateId(c.req.param("id"))}/jobs/${validateId(c.req.param("jid"))}/cancel`, "POST"); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/jobs/:jid/trace", async (c) => { try { const res = await gitlabApi(`/projects/${validateId(c.req.param("id"))}/jobs/${validateId(c.req.param("jid"))}/trace`); if (!res.ok) throw new Error(`HTTP ${res.status}`); let log = await res.text(); if (log.length > 50000) log = log.slice(-50000); return c.json({ log }); } catch (e: any) { return c.json({ error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/releases", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/releases`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/repository/tree", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/repository/tree`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/repository/branches", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/repository/branches`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });
gitlabRoutes.get("/projects/:id/labels", async (c) => { try { return await gitlabGet(c, `/projects/${validateId(c.req.param("id"))}/labels`); } catch (e: any) { return c.json({ items: [], error: e.message }, 500); } });

const pipelineSummaryRoute = createRoute({ method: 'get', path: '/pipelines/summary', tags: ['GitLab'], description: 'Pipeline summary across projects', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Pipeline summary' }, 500: { content: { 'application/json': { schema: z.any() } }, description: 'Error' } } });
gitlabRoutes.openapi(pipelineSummaryRoute, async (c) => {
  try {
    const projectsRes = await gitlabApi("/projects?membership=true&per_page=20&order_by=last_activity_at"); if (!projectsRes.ok) throw new Error(`HTTP ${projectsRes.status}`);
    const projects = await projectsRes.json() as any[];
    const summaries = await Promise.all(projects.slice(0, 10).map(async (p: any) => {
      try { const res = await gitlabApi(`/projects/${p.id}/pipelines?per_page=1`); if (!res.ok) return null; const pipelines = await res.json() as any[]; if (pipelines.length === 0) return null;
        return { projectId: p.id, projectName: p.name, pipelineId: pipelines[0].id, status: pipelines[0].status, ref: pipelines[0].ref, createdAt: pipelines[0].created_at, webUrl: pipelines[0].web_url }; }
      catch { return null; }
    }));
    return c.json({ pipelines: summaries.filter(Boolean) }, 200);
  } catch (e: any) { return c.json({ pipelines: [], error: e.message } as any, 500); }
});

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['GitLab'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
gitlabRoutes.openapi(healthRoute, (c) => c.json({ module: "gitlab", status: "ok" }, 200));
