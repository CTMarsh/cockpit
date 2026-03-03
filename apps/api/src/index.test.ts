import { describe, test, expect, beforeAll } from "bun:test";

const API = "http://localhost:4000";
let cookie = "";

// Helper to make authenticated requests
async function authedFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...opts,
    headers: { ...opts.headers as Record<string, string>, Cookie: cookie, "Content-Type": "application/json" },
  });
}

// ── Auth ─────────────────────────────────────────────────────
describe("Auth", () => {
  test("GET /api/auth/me without session returns 401", async () => {
    const res = await fetch(`${API}/api/auth/me`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
  });

  test("POST /api/auth/login with wrong credentials returns 401", async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrong", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/auth/login with valid credentials returns 200 + cookie", async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: process.env.COCKPIT_USER || "admin", password: process.env.COCKPIT_PASS || "cockpit" }),
    });
    expect(res.status).toBe(200);
    const setCookieHeader = res.headers.get("set-cookie");
    expect(setCookieHeader).toBeTruthy();
    cookie = setCookieHeader!.split(";")[0];
  });

  test("GET /api/auth/me with valid session returns authenticated", async () => {
    const res = await authedFetch("/api/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
  });
});

// ── Protected routes require auth ────────────────────────────
describe("Protected routes require auth", () => {
  const routes = ["/api/dashboard/stats", "/api/homelab/services", "/api/bookmarks", "/api/markdown/docs", "/api/randomizer/ideas"];
  for (const route of routes) {
    test(`GET ${route} returns 401 without auth`, async () => {
      const res = await fetch(`${API}${route}`);
      expect(res.status).toBe(401);
    });
  }
});

// ── Health checks ────────────────────────────────────────────
describe("Health endpoints (public)", () => {
  const healthRoutes = [
    "/api/health",
    "/api/homelab/health",
    "/api/bookmarks/health",
    "/api/markdown/health",
    "/api/randomizer/health",
    "/api/graph/health",
    "/api/sysmon/health",
    "/api/logs/health",
    "/api/cron/health",
    "/api/wol/health",
  ];

  for (const route of healthRoutes) {
    test(`GET ${route} returns ok`, async () => {
      const res = await fetch(`${API}${route}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
    });
  }
});

// ── Dashboard ────────────────────────────────────────────────
describe("Dashboard", () => {
  test("GET /api/dashboard/stats returns counts and recent items", async () => {
    const res = await authedFetch("/api/dashboard/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.bookmarkCount).toBe("number");
    expect(typeof data.docCount).toBe("number");
    expect(typeof data.serviceCount).toBe("number");
    expect(Array.isArray(data.recentBookmarks)).toBe(true);
    expect(Array.isArray(data.recentDocs)).toBe(true);
  });
});

// ── Homelab Services CRUD ────────────────────────────────────
describe("Homelab Services", () => {
  let serviceId: string;

  test("POST /api/homelab/services creates a service", async () => {
    const res = await authedFetch("/api/homelab/services", {
      method: "POST",
      body: JSON.stringify({ name: "Test Service", url: "https://example.com", expectedStatus: 200 }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Test Service");
    serviceId = data.id;
  });

  test("POST /api/homelab/services rejects missing fields", async () => {
    const res = await authedFetch("/api/homelab/services", {
      method: "POST",
      body: JSON.stringify({ name: "No URL" }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/homelab/services/:id updates a service", async () => {
    const res = await authedFetch(`/api/homelab/services/${serviceId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Service" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Service");
  });

  test("PUT /api/homelab/services/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/homelab/services/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("GET /api/homelab/services/:id/history returns history", async () => {
    const res = await authedFetch(`/api/homelab/services/${serviceId}/history`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.history)).toBe(true);
  });

  test("DELETE /api/homelab/services/:id removes service", async () => {
    const res = await authedFetch(`/api/homelab/services/${serviceId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(serviceId);
  });
});

// ── Docker Hosts CRUD ────────────────────────────────────────
describe("Docker Hosts", () => {
  let hostId: string;

  test("POST /api/homelab/docker-hosts creates a host", async () => {
    const res = await authedFetch("/api/homelab/docker-hosts", {
      method: "POST",
      body: JSON.stringify({ name: "Test Docker", url: "http://10.0.0.1:2375" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Test Docker");
    hostId = data.id;
  });

  test("POST /api/homelab/docker-hosts rejects missing fields", async () => {
    const res = await authedFetch("/api/homelab/docker-hosts", {
      method: "POST",
      body: JSON.stringify({ name: "No URL" }),
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/homelab/docker-hosts lists hosts", async () => {
    const res = await authedFetch("/api/homelab/docker-hosts");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.hosts)).toBe(true);
    expect(data.hosts.length).toBeGreaterThan(0);
  });

  test("DELETE /api/homelab/docker-hosts/:id removes host", async () => {
    const res = await authedFetch(`/api/homelab/docker-hosts/${hostId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

// ── Bookmarks CRUD ───────────────────────────────────────────
describe("Bookmarks", () => {
  let bookmarkId: string;

  test("POST /api/bookmarks creates a bookmark with auto-tags", async () => {
    const res = await authedFetch("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com", tags: ["test"] }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.url).toBe("https://example.com");
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags).toContain("test");
    bookmarkId = data.id;
  });

  test("POST /api/bookmarks rejects missing URL", async () => {
    const res = await authedFetch("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/bookmarks lists bookmarks", async () => {
    const res = await authedFetch("/api/bookmarks");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.bookmarks)).toBe(true);
    expect(data.total).toBeGreaterThan(0);
  });

  test("GET /api/bookmarks?q=example searches bookmarks", async () => {
    const res = await authedFetch("/api/bookmarks?q=example");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarks.length).toBeGreaterThan(0);
  });

  test("GET /api/bookmarks/tags returns tag counts", async () => {
    const res = await authedFetch("/api/bookmarks/tags");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.tags).toBe("object");
  });

  test("PUT /api/bookmarks/:id updates title and tags", async () => {
    const res = await authedFetch(`/api/bookmarks/${bookmarkId}`, {
      method: "PUT",
      body: JSON.stringify({ title: "Updated Title", tags: ["updated", "test"] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Updated Title");
    expect(data.tags).toContain("updated");
  });

  test("PUT /api/bookmarks/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/bookmarks/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("GET /api/bookmarks/export returns all bookmarks", async () => {
    const res = await authedFetch("/api/bookmarks/export");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.bookmarks)).toBe(true);
    expect(data.exportedAt).toBeTruthy();
  });

  test("POST /api/bookmarks/import imports bookmarks", async () => {
    const res = await authedFetch("/api/bookmarks/import", {
      method: "POST",
      body: JSON.stringify({ bookmarks: [{ url: "https://imported.com", title: "Imported" }] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
  });

  test("DELETE /api/bookmarks/:id removes bookmark", async () => {
    const res = await authedFetch(`/api/bookmarks/${bookmarkId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(bookmarkId);
  });

  test("DELETE /api/bookmarks/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/bookmarks/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ── Markdown Documents CRUD ──────────────────────────────────
describe("Markdown Documents", () => {
  const docId = "test-doc-" + Date.now();

  test("PUT /api/markdown/docs/:id creates/updates a document", async () => {
    const res = await authedFetch(`/api/markdown/docs/${docId}`, {
      method: "PUT",
      body: JSON.stringify({ content: "# Test Document\n\nThis is test content with some words." }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("Test Document");
    expect(data.word_count).toBeGreaterThan(0);
    expect(data.saved).toBe(true);
  });

  test("PUT /api/markdown/docs/:id rejects missing content", async () => {
    const res = await authedFetch(`/api/markdown/docs/${docId}`, {
      method: "PUT",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/markdown/docs lists documents", async () => {
    const res = await authedFetch("/api/markdown/docs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.docs)).toBe(true);
    expect(data.docs.length).toBeGreaterThan(0);
  });

  test("GET /api/markdown/docs/:id returns the document", async () => {
    const res = await authedFetch(`/api/markdown/docs/${docId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(docId);
    expect(data.content).toContain("Test Document");
  });

  test("GET /api/markdown/docs/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/markdown/docs/nonexistent");
    expect(res.status).toBe(404);
  });

  test("GET /api/markdown/search?q=test finds documents", async () => {
    const res = await authedFetch("/api/markdown/search?q=test");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThan(0);
  });

  test("GET /api/markdown/search without q returns 400", async () => {
    const res = await authedFetch("/api/markdown/search");
    expect(res.status).toBe(400);
  });

  test("DELETE /api/markdown/docs/:id removes document", async () => {
    const res = await authedFetch(`/api/markdown/docs/${docId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(docId);
  });

  test("DELETE /api/markdown/docs/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/markdown/docs/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ── Knowledge Graph ──────────────────────────────────────────
describe("Knowledge Graph", () => {
  test("GET /api/graph/data returns nodes and edges", async () => {
    const res = await authedFetch("/api/graph/data");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(Array.isArray(data.edges)).toBe(true);
  });

  test("POST /api/graph/edges creates an edge", async () => {
    const res = await authedFetch("/api/graph/edges", {
      method: "POST",
      body: JSON.stringify({ sourceId: "test-1", sourceType: "bookmark", targetId: "test-2", targetType: "document", label: "related" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.label).toBe("related");
  });
});

// ── Randomizer ───────────────────────────────────────────────
describe("Randomizer", () => {
  test("GET /api/randomizer/ideas returns ideas list", async () => {
    const res = await authedFetch("/api/randomizer/ideas");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.ideas)).toBe(true);
    expect(data.ideas.length).toBeGreaterThan(0);
  });

  test("GET /api/randomizer/random returns a single idea", async () => {
    const res = await authedFetch("/api/randomizer/random");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBeTruthy();
    expect(data.difficulty).toBeTruthy();
  });

  test("GET /api/randomizer/random?difficulty=beginner filters by difficulty", async () => {
    const res = await authedFetch("/api/randomizer/random?difficulty=beginner");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.difficulty).toBe("beginner");
  });

  test("GET /api/randomizer/favorites returns favorites list", async () => {
    const res = await authedFetch("/api/randomizer/favorites");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.favorites)).toBe(true);
  });
});

// ── Cron Jobs CRUD ───────────────────────────────────────────
describe("Cron Jobs", () => {
  let jobId: string;

  test("POST /api/cron/jobs creates a job", async () => {
    const res = await authedFetch("/api/cron/jobs", {
      method: "POST",
      body: JSON.stringify({ name: "Test Job", schedule: "0 * * * *", command: "echo test" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Test Job");
    expect(data.schedule).toBe("0 * * * *");
    jobId = data.id;
  });

  test("POST /api/cron/jobs rejects missing fields", async () => {
    const res = await authedFetch("/api/cron/jobs", {
      method: "POST",
      body: JSON.stringify({ name: "No Command" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/cron/jobs rejects invalid cron expression", async () => {
    const res = await authedFetch("/api/cron/jobs", {
      method: "POST",
      body: JSON.stringify({ name: "Bad Cron", schedule: "invalid", command: "echo test" }),
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/cron/jobs lists jobs", async () => {
    const res = await authedFetch("/api/cron/jobs");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.jobs)).toBe(true);
    expect(data.jobs.length).toBeGreaterThan(0);
  });

  test("PUT /api/cron/jobs/:id updates a job", async () => {
    const res = await authedFetch(`/api/cron/jobs/${jobId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Job", enabled: false }),
    });
    expect(res.status).toBe(200);
  });

  test("PUT /api/cron/jobs/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/cron/jobs/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/cron/jobs/:id removes job", async () => {
    const res = await authedFetch(`/api/cron/jobs/${jobId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

// ── Wake-on-LAN Devices CRUD ─────────────────────────────────
describe("WoL Devices", () => {
  let deviceId: string;

  test("POST /api/wol/devices creates a device", async () => {
    const res = await authedFetch("/api/wol/devices", {
      method: "POST",
      body: JSON.stringify({ name: "Test PC", mac: "AA:BB:CC:DD:EE:FF", ip: "10.0.0.100" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Test PC");
    expect(data.mac).toBe("AA:BB:CC:DD:EE:FF");
    deviceId = data.id;
  });

  test("POST /api/wol/devices rejects missing fields", async () => {
    const res = await authedFetch("/api/wol/devices", {
      method: "POST",
      body: JSON.stringify({ name: "No MAC" }),
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/wol/devices rejects invalid MAC format", async () => {
    const res = await authedFetch("/api/wol/devices", {
      method: "POST",
      body: JSON.stringify({ name: "Bad MAC", mac: "not-a-mac" }),
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/wol/devices lists devices", async () => {
    const res = await authedFetch("/api/wol/devices");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.devices)).toBe(true);
    expect(data.devices.length).toBeGreaterThan(0);
  });

  test("PUT /api/wol/devices/:id updates a device", async () => {
    const res = await authedFetch(`/api/wol/devices/${deviceId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Updated PC" }),
    });
    expect(res.status).toBe(200);
  });

  test("PUT /api/wol/devices/nonexistent returns 404", async () => {
    const res = await authedFetch("/api/wol/devices/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/wol/devices/:id removes device", async () => {
    const res = await authedFetch(`/api/wol/devices/${deviceId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
  });
});

// ── Container Actions (validates input) ──────────────────────
describe("Container Actions", () => {
  test("POST /api/homelab/containers/fake/invalid rejects bad action", async () => {
    const res = await authedFetch("/api/homelab/containers/fake/invalid", { method: "POST" });
    expect(res.status).toBe(400);
  });
});

// ── Auth: Logout ─────────────────────────────────────────────
describe("Auth Logout", () => {
  test("POST /api/auth/logout clears session", async () => {
    const res = await authedFetch("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
