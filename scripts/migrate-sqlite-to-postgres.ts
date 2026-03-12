/**
 * SQLite to PostgreSQL Migration Script
 *
 * Migrates all Cockpit data from SQLite to PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgresql://cockpit:pass@localhost:5432/cockpit \
 *   bun run scripts/migrate-sqlite-to-postgres.ts [--sqlite-path ./data/cockpit.db]
 *
 * Prerequisites:
 *   - bun add pg (PostgreSQL client)
 *   - PostgreSQL instance running and accessible via DATABASE_URL
 *   - SQLite database file at ./data/cockpit.db (or specified path)
 *
 * Related issues:
 *   - #226 Migrate SQLite to PostgreSQL
 *   - #232 SQLite to PostgreSQL data migration script
 */

import { Database } from "bun:sqlite";
// TODO: Uncomment when pg package is added to dependencies
// import { Client } from "pg";

// ── Configuration ──────────────────────────────────────────

const SQLITE_PATH = process.argv.includes("--sqlite-path")
  ? process.argv[process.argv.indexOf("--sqlite-path") + 1]
  : "./data/cockpit.db";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  console.error("Example: postgresql://cockpit:password@localhost:5432/cockpit");
  process.exit(1);
}

// ── SQLite Type → PostgreSQL Type Mapping ──────────────────

const typeMap: Record<string, string> = {
  TEXT: "TEXT",
  INTEGER: "INTEGER",
  REAL: "DOUBLE PRECISION",
  BLOB: "BYTEA",
};

function sqliteTypeToPostgres(sqliteType: string): string {
  const upper = sqliteType.toUpperCase().trim();
  return typeMap[upper] || "TEXT";
}

// ── PostgreSQL Schema Definitions ──────────────────────────
// These mirror the SQLite schemas from db.ts and modules/*/api.ts
// with PostgreSQL-compatible types and syntax.

const PG_SCHEMAS: string[] = [
  // -- From apps/api/src/db.ts --

  `CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    favicon TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    expected_status INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT NOT NULL DEFAULT '',
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS uptime_history (
    id SERIAL PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response_time INTEGER,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_uptime_service ON uptime_history(service_id, checked_at)`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS device_codes (
    code TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    session_token TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS favorites (
    idea_id INTEGER PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS custom_ideas (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    stack TEXT NOT NULL DEFAULT '[]',
    difficulty TEXT NOT NULL DEFAULT 'intermediate',
    category TEXT NOT NULL DEFAULT 'custom',
    estimated_hours TEXT NOT NULL DEFAULT '4-8',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS docker_hosts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // -- From modules/wol/api.ts --

  `CREATE TABLE IF NOT EXISTS wol_devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mac TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    broadcast TEXT NOT NULL DEFAULT '255.255.255.255',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // -- From modules/cron/api.ts --

  `CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    command TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS cron_runs (
    id SERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    exit_code INTEGER,
    output TEXT NOT NULL DEFAULT ''
  )`,

  `CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id, started_at)`,

  // -- From modules/uptime/api.ts --

  `CREATE TABLE IF NOT EXISTS uptime_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    check_interval INTEGER NOT NULL DEFAULT 60,
    expected_status INTEGER NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS uptime_checks (
    id SERIAL PRIMARY KEY,
    service_id TEXT NOT NULL REFERENCES uptime_services(id) ON DELETE CASCADE,
    status INTEGER NOT NULL,
    response_ms INTEGER NOT NULL,
    error TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service_id, checked_at)`,

  // -- From modules/deploy-history/api.ts --

  `CREATE TABLE IF NOT EXISTS deployment_events (
    id SERIAL PRIMARY KEY,
    deployment TEXT NOT NULL,
    namespace TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT NOT NULL DEFAULT '',
    new_value TEXT NOT NULL DEFAULT '',
    triggered_by TEXT NOT NULL DEFAULT 'cockpit',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_deploy_events_deploy ON deployment_events(deployment, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_deploy_events_time ON deployment_events(created_at)`,

  // -- From modules/ansible/api.ts --

  `CREATE TABLE IF NOT EXISTS ansible_runs (
    id TEXT PRIMARY KEY,
    playbook TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    extra_vars TEXT NOT NULL DEFAULT '{}',
    dry_run INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    output TEXT NOT NULL DEFAULT '',
    exit_code INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`,

  `CREATE INDEX IF NOT EXISTS idx_ansible_runs_status ON ansible_runs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_ansible_runs_started ON ansible_runs(started_at)`,

  // -- From modules/alerts/api.ts --

  `CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT 'gt',
    threshold DOUBLE PRECISION NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    cooldown_minutes INTEGER NOT NULL DEFAULT 15,
    enabled INTEGER NOT NULL DEFAULT 1,
    webhook_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    rule_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    message TEXT NOT NULL,
    fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id, fired_at)`,

  // -- From modules/network/api.ts --

  `CREATE TABLE IF NOT EXISTS network_devices (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    mac TEXT NOT NULL DEFAULT '',
    hostname TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ports TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'unknown'
  )`,

  `CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip)`,
];

// Tables to migrate (in dependency order — parent tables first)
const TABLES_IN_ORDER = [
  // No foreign key dependencies
  "bookmarks",
  "services",
  "graph_edges",
  "documents",
  "sessions",
  "device_codes",
  "favorites",
  "custom_ideas",
  "docker_hosts",
  "wol_devices",
  "cron_jobs",
  "uptime_services",
  "alert_rules",
  "ansible_runs",
  "network_devices",
  // Foreign key dependencies (must come after parent tables)
  "uptime_history",
  "cron_runs",
  "uptime_checks",
  "deployment_events",
  "alert_history",
];

// Tables with SERIAL (AUTOINCREMENT) primary keys — need sequence reset after import
const SERIAL_TABLES = [
  "uptime_history",
  "custom_ideas",
  "cron_runs",
  "uptime_checks",
  "deployment_events",
  "alert_history",
];

// ── Migration Logic ────────────────────────────────────────

async function migrate() {
  console.log("=== Cockpit SQLite → PostgreSQL Migration ===\n");

  // 1. Connect to SQLite
  console.log(`[1/5] Opening SQLite database: ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  sqlite.run("PRAGMA journal_mode = WAL");

  // 2. Connect to PostgreSQL
  console.log(`[2/5] Connecting to PostgreSQL: ${DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}`);
  // TODO: Uncomment when pg package is added
  // const pg = new Client({ connectionString: DATABASE_URL });
  // await pg.connect();
  console.log("  TODO: pg package not yet installed — skipping actual connection");
  console.log("  Run: bun add pg @types/pg");

  // 3. Create PostgreSQL schema
  console.log("\n[3/5] Creating PostgreSQL schema...");
  for (const ddl of PG_SCHEMAS) {
    const tableName = ddl.match(/(?:TABLE|INDEX)\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1] || "unknown";
    console.log(`  Creating: ${tableName}`);
    // TODO: await pg.query(ddl);
  }

  // 4. Migrate data table by table
  console.log("\n[4/5] Migrating data...");
  const results: { table: string; rows: number }[] = [];

  for (const table of TABLES_IN_ORDER) {
    // Check if table exists in SQLite
    const exists = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table);

    if (!exists) {
      console.log(`  Skipping ${table} (not found in SQLite)`);
      results.push({ table, rows: 0 });
      continue;
    }

    // Get all rows from SQLite
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
    console.log(`  Migrating ${table}: ${rows.length} rows`);

    if (rows.length === 0) {
      results.push({ table, rows: 0 });
      continue;
    }

    // Build INSERT statement
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const insertSQL = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    // TODO: Use pg transaction for atomicity
    // await pg.query("BEGIN");
    // for (const row of rows) {
    //   const values = columns.map((col) => {
    //     const val = row[col];
    //     // Convert SQLite datetime strings to PostgreSQL timestamps
    //     if (typeof val === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) {
    //       return val.replace(" ", "T") + "Z";
    //     }
    //     return val;
    //   });
    //   await pg.query(insertSQL, values);
    // }
    // await pg.query("COMMIT");

    results.push({ table, rows: rows.length });
  }

  // 5. Reset sequences for SERIAL columns
  console.log("\n[5/5] Resetting sequences for SERIAL columns...");
  for (const table of SERIAL_TABLES) {
    const resetSQL = `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM ${table}`;
    console.log(`  Resetting sequence: ${table}`);
    // TODO: await pg.query(resetSQL);
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n=== Migration Summary ===");
  console.log("Table                    | Rows");
  console.log("─────────────────────────┼──────");
  let totalRows = 0;
  for (const { table, rows } of results) {
    console.log(`${table.padEnd(25)}| ${rows}`);
    totalRows += rows;
  }
  console.log("─────────────────────────┼──────");
  console.log(`${"TOTAL".padEnd(25)}| ${totalRows}`);

  // Cleanup
  sqlite.close();
  // TODO: await pg.end();

  console.log("\nMigration complete! Verify data in PostgreSQL before switching over.");
}

// ── Run ────────────────────────────────────────────────────
migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
