import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://cockpit:cockpit@localhost:5432/cockpit";

const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Run migrations
async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      favicon TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      expected_status INTEGER NOT NULL DEFAULT 200,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      weight INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled',
      content TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS uptime_history (
      id SERIAL PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      response_time INTEGER,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_uptime_service ON uptime_history(service_id, checked_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS device_codes (
      code TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      session_token TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS favorites (
      idea_id INTEGER PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS custom_ideas (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      stack TEXT NOT NULL DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'intermediate',
      category TEXT NOT NULL DEFAULT 'custom',
      estimated_hours TEXT NOT NULL DEFAULT '4-8',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS docker_hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Rate limiting table (replaces in-memory Map for HA)
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `;

  // Module tables

  await sql`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      command TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cron_runs (
      id SERIAL PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      exit_code INTEGER,
      output TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id, started_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS wol_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mac TEXT NOT NULL,
      ip TEXT,
      broadcast TEXT NOT NULL DEFAULT '255.255.255.255',
      port INTEGER NOT NULL DEFAULT 9,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_rules (
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
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_history (
      id SERIAL PRIMARY KEY,
      rule_id TEXT NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
      rule_name TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      value DOUBLE PRECISION NOT NULL,
      threshold DOUBLE PRECISION NOT NULL,
      message TEXT NOT NULL,
      fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id, fired_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS deployment_events (
      id SERIAL PRIMARY KEY,
      namespace TEXT NOT NULL,
      deployment TEXT NOT NULL,
      image TEXT NOT NULL,
      previous_image TEXT,
      status TEXT NOT NULL DEFAULT 'started',
      triggered_by TEXT NOT NULL DEFAULT 'ci',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_deploy_events_ns ON deployment_events(namespace, deployment)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_deploy_events_time ON deployment_events(started_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS uptime_services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      expected_status INTEGER NOT NULL DEFAULT 200,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      timeout_ms INTEGER NOT NULL DEFAULT 5000,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS uptime_checks (
      id SERIAL PRIMARY KEY,
      service_id TEXT NOT NULL REFERENCES uptime_services(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_uptime_checks_service ON uptime_checks(service_id, checked_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS network_devices (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      mac TEXT,
      hostname TEXT,
      vendor TEXT,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      open_ports TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT ''
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ansible_runs (
      id TEXT PRIMARY KEY,
      playbook TEXT NOT NULL,
      tags TEXT,
      extra_vars TEXT,
      dry_run INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      exit_code INTEGER,
      output TEXT NOT NULL DEFAULT '',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ansible_runs_status ON ansible_runs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ansible_runs_started ON ansible_runs(started_at)`;

  // Seed default homelab services
  const defaults: [string, string, string, string, number][] = [
    ["cockpit", "Cockpit Dashboard", "https://dashboard.noahsark.me", "layout-dashboard", 0],
    ["gitlab", "GitLab", "https://gitlab.noahsark.me", "gitlab", 0],
    ["proxmox", "Proxmox VE", "https://pve.noahsark.me:8006", "server", 0],
    ["home-assistant", "Home Assistant", "https://hass.noahsark.me", "home", 0],
    ["rustfs", "RustFS Console", "https://s3.noahsark.me:9001", "database", 0],
    ["notify", "Notify", "https://notify.noahsark.me", "bell", 0],
    ["traefik", "Traefik Dashboard", "https://traefik.noahsark.me", "network", 0],
    ["rancher", "Rancher", "https://rancher.noahsark.me", "monitor", 0],
    ["cloudflare-dns", "Cloudflare DNS", "https://one.one.one.one", "cloud", 0],
  ];
  for (const [id, name, url, icon, expected] of defaults) {
    await sql`INSERT INTO services (id, name, url, icon, expected_status) VALUES (${id}, ${name}, ${url}, ${icon}, ${expected}) ON CONFLICT (id) DO NOTHING`;
  }
}

export { sql, migrate };
export default sql;
