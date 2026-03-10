import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "cockpit.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

// Run migrations
db.run(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    favicon TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    expected_status INTEGER NOT NULL DEFAULT 200,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS uptime_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id TEXT NOT NULL,
    status TEXT NOT NULL,
    response_time INTEGER,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  )
`);

db.run(`CREATE INDEX IF NOT EXISTS idx_uptime_service ON uptime_history(service_id, checked_at)`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS device_codes (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    session_token TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS favorites (
    idea_id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS custom_ideas (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    stack TEXT NOT NULL DEFAULT '[]',
    difficulty TEXT NOT NULL DEFAULT 'intermediate',
    category TEXT NOT NULL DEFAULT 'custom',
    estimated_hours TEXT NOT NULL DEFAULT '4-8',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS docker_hosts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Seed default homelab services (INSERT OR IGNORE preserves any user customizations)
{
  const seed = db.prepare(
    "INSERT OR IGNORE INTO services (id, name, url, icon, expected_status) VALUES (?, ?, ?, ?, ?)"
  );
  const defaults: [string, string, string, string, number][] = [
    ["cockpit", "Cockpit Dashboard", "https://dashboard.noahsark.me", "layout-dashboard", 0],
    ["gitlab", "GitLab", "https://gitlab.noahsark.me", "gitlab", 0],
    ["proxmox", "Proxmox VE", "https://pve.noahsark.me:8006", "server", 0],
    ["home-assistant", "Home Assistant", "https://hass.noahsark.me", "home", 0],
    ["minio", "MinIO Console", "https://minio.noahsark.me:9001", "database", 0],
    ["notify", "Notify", "https://notify.noahsark.me", "bell", 0],
    ["traefik", "Traefik Dashboard", "https://traefik.noahsark.me", "network", 0],
    ["rancher", "Rancher", "https://rancher.noahsark.me", "monitor", 0],
    ["cloudflare-dns", "Cloudflare DNS", "https://one.one.one.one", "cloud", 0],
  ];
  for (const [id, name, url, icon, expected] of defaults) {
    seed.run(id, name, url, icon, expected);
  }
}

export { db };
export default db;
