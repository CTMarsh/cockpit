import { Hono } from "hono";

export const randomizerRoutes = new Hono();

interface ProjectIdea {
  id: number;
  title: string;
  description: string;
  stack: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimatedHours: string;
}

const ideas: ProjectIdea[] = [
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

randomizerRoutes.get("/health", (c) => c.json({ module: "randomizer", status: "ok" }));

// Get a random project idea (with optional filters)
randomizerRoutes.get("/random", (c) => {
  let pool = [...ideas];
  const stack = c.req.query("stack");
  const difficulty = c.req.query("difficulty");
  const category = c.req.query("category");

  if (stack) pool = pool.filter((i) => i.stack.some((s) => s.includes(stack.toLowerCase())));
  if (difficulty) pool = pool.filter((i) => i.difficulty === difficulty);
  if (category) pool = pool.filter((i) => i.category === category);

  if (pool.length === 0) return c.json({ error: "No ideas match your filters" }, 404);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return c.json(pick);
});

// Get all ideas
randomizerRoutes.get("/ideas", (c) => {
  return c.json({ ideas, total: ideas.length });
});

// Get filter options
randomizerRoutes.get("/filters", (c) => {
  const stacks = [...new Set(ideas.flatMap((i) => i.stack))].sort();
  const difficulties = [...new Set(ideas.map((i) => i.difficulty))];
  const categories = [...new Set(ideas.map((i) => i.category))].sort();
  return c.json({ stacks, difficulties, categories });
});
