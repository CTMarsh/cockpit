import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "../../apps/api/src/db";

export const randomizerRoutes = new OpenAPIHono();

interface ProjectIdea {
  id: number;
  title: string;
  description: string;
  stack: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimatedHours: string;
  isCustom?: boolean;
}

const builtinIdeas: ProjectIdea[] = [
  { id: 1, title: "CLI Password Manager", description: "Encrypted password storage with terminal UI. AES-256 encryption, clipboard integration, password generation.", stack: ["typescript", "node"], difficulty: "intermediate", category: "security", estimatedHours: "8-12" },
  { id: 2, title: "Real-Time Chat Room", description: "WebSocket-based chat with rooms, typing indicators, and message history.", stack: ["typescript", "react", "websocket"], difficulty: "intermediate", category: "web", estimatedHours: "6-10" },
  { id: 3, title: "Git Commit Visualizer", description: "Parse git history and render an interactive commit graph with branch visualization.", stack: ["typescript", "d3", "git"], difficulty: "advanced", category: "devtools", estimatedHours: "12-20" },
  { id: 4, title: "Weather Station Dashboard", description: "Collect sensor data (or API data) and display with charts. Temperature, humidity, pressure trends.", stack: ["typescript", "react", "chart.js"], difficulty: "beginner", category: "iot", estimatedHours: "4-8" },
  { id: 5, title: "URL Shortener with Analytics", description: "Shorten URLs, track clicks, show geographic data and referrers on a dashboard.", stack: ["typescript", "sqlite", "react"], difficulty: "beginner", category: "web", estimatedHours: "4-6" },
  { id: 6, title: "Markdown Blog Engine", description: "Static site generator from markdown files. Hot reload, syntax highlighting, RSS feed.", stack: ["typescript", "node"], difficulty: "intermediate", category: "web", estimatedHours: "8-15" },
  { id: 7, title: "Network Scanner TUI", description: "Terminal UI that scans local network, shows devices, open ports, and service detection.", stack: ["typescript", "node"], difficulty: "advanced", category: "security", estimatedHours: "10-16" },
  { id: 8, title: "Pomodoro Timer with Stats", description: "Focus timer with session history, streak tracking, and productivity graphs.", stack: ["typescript", "react"], difficulty: "beginner", category: "productivity", estimatedHours: "3-6" },
  { id: 9, title: "RSS Feed Aggregator", description: "Self-hosted feed reader. Parse RSS/Atom, categorize, mark read/unread, keyboard navigation.", stack: ["typescript", "react", "sqlite"], difficulty: "intermediate", category: "productivity", estimatedHours: "10-16" },
  { id: 10, title: "Image Optimization Pipeline", description: "Drag-drop images, auto-resize, compress, convert formats. Batch processing with progress.", stack: ["typescript", "sharp", "react"], difficulty: "intermediate", category: "devtools", estimatedHours: "6-10" },
  { id: 11, title: "API Mock Server", description: "Define endpoints via JSON/YAML config. Auto-generates realistic fake data. Great for frontend dev.", stack: ["typescript", "node"], difficulty: "beginner", category: "devtools", estimatedHours: "4-8" },
  { id: 12, title: "File Encryption Tool", description: "Encrypt/decrypt files with AES-256-GCM. Key derivation from passwords. Progress for large files.", stack: ["typescript", "node", "crypto"], difficulty: "intermediate", category: "security", estimatedHours: "6-10" },
  { id: 13, title: "Container Log Viewer", description: "Real-time Docker container log viewer with filtering, search, and color coding.", stack: ["typescript", "react", "docker"], difficulty: "intermediate", category: "devops", estimatedHours: "8-12" },
  { id: 14, title: "Habit Tracker", description: "Daily habit tracking with streak visualization, heat maps, and weekly/monthly reports.", stack: ["typescript", "react", "sqlite"], difficulty: "beginner", category: "productivity", estimatedHours: "6-10" },
  { id: 15, title: "DNS Lookup Tool", description: "Batch DNS lookups with visualized record trees. Compare DNS across providers.", stack: ["typescript", "node"], difficulty: "beginner", category: "networking", estimatedHours: "3-6" },
  { id: 16, title: "Code Snippet Manager", description: "Save, tag, and search code snippets. Syntax highlighting, copy-to-clipboard, import/export.", stack: ["typescript", "react", "sqlite"], difficulty: "intermediate", category: "devtools", estimatedHours: "8-12" },
  { id: 17, title: "System Monitor Dashboard", description: "Real-time CPU, memory, disk, network charts. Process list with kill capability.", stack: ["typescript", "react", "node"], difficulty: "advanced", category: "devops", estimatedHours: "12-20" },
  { id: 18, title: "Retro Snake Game", description: "Classic snake in the browser. Progressive difficulty, high scores, sound effects.", stack: ["typescript", "canvas"], difficulty: "beginner", category: "game", estimatedHours: "3-6" },
  { id: 19, title: "Invoice Generator", description: "Create professional PDF invoices. Client management, line items, tax calculation, templates.", stack: ["typescript", "react", "puppeteer"], difficulty: "intermediate", category: "business", estimatedHours: "10-16" },
  { id: 20, title: "Cron Job Dashboard", description: "Manage and monitor cron jobs. Visual scheduler, execution history, failure alerts.", stack: ["typescript", "react", "node"], difficulty: "advanced", category: "devops", estimatedHours: "12-18" },
];

function getAllIdeas(): ProjectIdea[] {
  const customRows = db.query("SELECT * FROM custom_ideas ORDER BY created_at DESC").all() as any[];
  const custom: ProjectIdea[] = customRows.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    stack: JSON.parse(r.stack || "[]"),
    difficulty: r.difficulty,
    category: r.category,
    estimatedHours: r.estimated_hours,
    isCustom: true,
  }));
  return [...builtinIdeas, ...custom];
}

function generatePrompt(idea: ProjectIdea): string {
  return `Build a "${idea.title}" project from scratch.

## Project Description
${idea.description}

## Technical Requirements
- **Tech Stack:** ${idea.stack.join(", ")}
- **Difficulty:** ${idea.difficulty}
- **Category:** ${idea.category}
- **Estimated Time:** ${idea.estimatedHours} hours

## Instructions for Claude Code
1. Create a new project directory with a clear folder structure
2. Use TypeScript throughout with strict mode enabled
3. Set up the project with \`bun init\` and install dependencies
4. Implement the core functionality first, then add polish
5. Include proper error handling and input validation
6. Add a README.md with setup instructions and usage examples
7. Make it self-contained — no external services required unless specified
8. Use modern best practices: ESM imports, async/await, typed interfaces
9. If it has a UI, use a minimal framework (React + Vite or plain HTML/CSS)
10. Include at least 3 example use cases to demonstrate the tool works

## Quality Checklist
- [ ] Project builds without errors (\`bun build\` or \`tsc --noEmit\`)
- [ ] Core feature works end-to-end
- [ ] Error states are handled gracefully
- [ ] Code is clean, well-structured, and documented
- [ ] README explains how to install, configure, and run`;
}

const healthRoute = createRoute({ method: 'get', path: '/health', tags: ['Randomizer'], responses: { 200: { content: { 'application/json': { schema: z.object({ module: z.string(), status: z.string() }) } }, description: 'Module health' } } });
randomizerRoutes.openapi(healthRoute, (c) => c.json({ module: "randomizer", status: "ok" }, 200));

const randomRoute = createRoute({ method: 'get', path: '/random', tags: ['Randomizer'], description: 'Get a random project idea', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Random idea with prompt' }, 404: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'No matches' } } });
randomizerRoutes.openapi(randomRoute, (c) => {
  const ideas = getAllIdeas();
  let pool = [...ideas];
  const stack = c.req.query("stack");
  const difficulty = c.req.query("difficulty");
  const category = c.req.query("category");

  if (stack) pool = pool.filter((i) => i.stack.some((s) => s.includes(stack.toLowerCase())));
  if (difficulty) pool = pool.filter((i) => i.difficulty === difficulty);
  if (category) pool = pool.filter((i) => i.category === category);

  if (pool.length === 0) return c.json({ error: "No ideas match your filters" } as any, 404);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return c.json({ ...pick, prompt: generatePrompt(pick) } as any, 200);
});

const ideasRoute = createRoute({ method: 'get', path: '/ideas', tags: ['Randomizer'], description: 'List all project ideas', responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Ideas list' } } });
randomizerRoutes.openapi(ideasRoute, (c) => {
  const ideas = getAllIdeas();
  return c.json({ ideas, total: ideas.length }, 200);
});

const filtersRoute = createRoute({ method: 'get', path: '/filters', tags: ['Randomizer'], description: 'Get available filter options', responses: { 200: { content: { 'application/json': { schema: z.object({ stacks: z.array(z.string()), difficulties: z.array(z.string()), categories: z.array(z.string()) }) } }, description: 'Filter options' } } });
randomizerRoutes.openapi(filtersRoute, (c) => {
  const ideas = getAllIdeas();
  const stacks = [...new Set(ideas.flatMap((i) => i.stack))].sort();
  const difficulties = [...new Set(ideas.map((i) => i.difficulty))];
  const categories = [...new Set(ideas.map((i) => i.category))].sort();
  return c.json({ stacks, difficulties, categories }, 200);
});

// Favorites
const favoritesRoute = createRoute({ method: 'get', path: '/favorites', tags: ['Randomizer'], description: 'List favorite idea IDs', responses: { 200: { content: { 'application/json': { schema: z.object({ favorites: z.array(z.number()) }) } }, description: 'Favorites' } } });
randomizerRoutes.openapi(favoritesRoute, (c) => {
  const rows = db.query("SELECT idea_id FROM favorites ORDER BY created_at DESC").all() as any[];
  return c.json({ favorites: rows.map((r: any) => r.idea_id) }, 200);
});

const addFavoriteRoute = createRoute({ method: 'post', path: '/favorites/{id}', tags: ['Randomizer'], description: 'Add idea to favorites', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ favorited: z.number() }) } }, description: 'Favorited' } } });
randomizerRoutes.openapi(addFavoriteRoute, (c) => {
  const ideaId = Number(c.req.valid('param').id);
  db.query("INSERT OR IGNORE INTO favorites (idea_id) VALUES (?)").run(ideaId);
  return c.json({ favorited: ideaId }, 200);
});

const removeFavoriteRoute = createRoute({ method: 'delete', path: '/favorites/{id}', tags: ['Randomizer'], description: 'Remove idea from favorites', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ unfavorited: z.number() }) } }, description: 'Unfavorited' } } });
randomizerRoutes.openapi(removeFavoriteRoute, (c) => {
  const ideaId = Number(c.req.valid('param').id);
  db.query("DELETE FROM favorites WHERE idea_id = ?").run(ideaId);
  return c.json({ unfavorited: ideaId }, 200);
});

// Custom ideas
const createIdeaRoute = createRoute({ method: 'post', path: '/ideas', tags: ['Randomizer'], description: 'Create a custom project idea', request: { body: { content: { 'application/json': { schema: z.object({ title: z.string(), description: z.string().optional(), stack: z.array(z.string()).optional(), difficulty: z.string().optional(), category: z.string().optional(), estimatedHours: z.string().optional() }) } } } }, responses: { 201: { content: { 'application/json': { schema: z.object({ id: z.number(), created: z.boolean() }) } }, description: 'Created' }, 400: { content: { 'application/json': { schema: z.object({ error: z.string() }) } }, description: 'Validation error' } } });
randomizerRoutes.openapi(createIdeaRoute, async (c) => {
  const body = c.req.valid('json');
  if (!body.title) return c.json({ error: "title is required" } as any, 400);
  const id = Date.now();
  db.query(
    "INSERT INTO custom_ideas (id, title, description, stack, difficulty, category, estimated_hours) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, body.title, body.description || "", JSON.stringify(body.stack || []), body.difficulty || "intermediate", body.category || "custom", body.estimatedHours || "4-8");
  return c.json({ id, created: true }, 201);
});

const deleteIdeaRoute = createRoute({ method: 'delete', path: '/ideas/{id}', tags: ['Randomizer'], description: 'Delete a custom idea', request: { params: z.object({ id: z.string() }) }, responses: { 200: { content: { 'application/json': { schema: z.object({ deleted: z.number() }) } }, description: 'Deleted' } } });
randomizerRoutes.openapi(deleteIdeaRoute, (c) => {
  const id = Number(c.req.valid('param').id);
  db.query("DELETE FROM custom_ideas WHERE id = ?").run(id);
  return c.json({ deleted: id }, 200);
});
