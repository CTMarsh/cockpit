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

  // Seed default homelab services
  const defaults: [string, string, string, string, number][] = [
    ["cockpit", "Cockpit Dashboard", "https://dashboard.noahsark.me", "layout-dashboard", 0],
    ["gitlab", "GitLab", "https://gitlab.noahsark.me", "gitlab", 0],
    ["proxmox", "Proxmox VE", "https://pve.noahsark.me:8006", "server", 0],
    ["home-assistant", "Home Assistant", "https://hass.noahsark.me", "home", 0],
    ["rustfs", "RustFS Console", "https://rustfs.noahsark.me", "database", 0],
    ["notify", "Notify", "https://notify.noahsark.me", "bell", 0],
    ["traefik", "Traefik Dashboard", "https://traefik.noahsark.me", "network", 0],
    ["rancher", "Rancher", "https://rancher.noahsark.me", "monitor", 0],
    ["cloudflare-dns", "Cloudflare DNS", "https://one.one.one.one", "cloud", 0],
    ["argocd", "ArgoCD", "https://argocd.noahsark.me", "git-branch", 0],
    ["vault", "Vault", "https://vault.noahsark.me", "lock", 0],
    ["openbao", "OpenBao", "http://10.0.80.75:8200", "lock", 0],
    ["grafana", "Grafana", "https://grafana.noahsark.me", "line-chart", 0],
    ["prometheus", "Prometheus", "https://prometheus.noahsark.me", "activity", 0],
    ["alertmanager", "Alertmanager", "https://alertmanager.noahsark.me", "bell-ring", 0],
    ["pushgateway", "Pushgateway", "https://pushgateway.noahsark.me", "upload", 0],
    ["pgadmin", "pgAdmin", "https://pgadmin.noahsark.me", "database", 0],
    ["supabase", "Supabase", "https://supabase.noahsark.me", "database", 0],
    ["supabase-studio", "Supabase Studio", "https://supabase-studio.noahsark.me", "layout-grid", 0],
    ["chat-app", "Chat App", "https://chat.noahsark.me", "message-circle", 0],
    ["openwebui", "Open WebUI", "https://ai.noahsark.me", "brain", 0],
    ["ollama", "Ollama API", "https://ollama.noahsark.me", "cpu", 0],
    ["speaches", "Speaches (STT/TTS)", "https://speaches.noahsark.me", "mic", 0],
    ["goldilocks", "Goldilocks", "https://goldilocks.noahsark.me", "gauge", 0],
    ["polaris", "Polaris", "https://polaris.noahsark.me", "shield-check", 0],
    ["policy-reporter", "Policy Reporter", "https://policy-reporter.noahsark.me", "file-text", 0],
    ["kyverno-playground", "Kyverno Playground", "https://kyverno-playground.noahsark.me", "shield", 0],
    ["photovault", "PhotoVault", "https://photovault.noahsark.me", "camera", 0],
    ["mixvault", "MixVault", "https://mixvault.noahsark.me", "disc-3", 0],
    ["3cx", "3CX Communicate", "https://communicate.noahsark.me", "phone", 0],
  ];
  for (const [id, name, url, icon, expected] of defaults) {
    await sql`INSERT INTO services (id, name, url, icon, expected_status) VALUES (${id}, ${name}, ${url}, ${icon}, ${expected}) ON CONFLICT (id) DO NOTHING`;
  }

  // One-off fix for the stale RustFS console URL seeded prior to 2026-05-23 (port-based
  // s3.noahsark.me:9001 -> hostname-based rustfs.noahsark.me). ON CONFLICT DO NOTHING
  // on the seed above will not update existing rows, so we patch directly here.
  await sql`UPDATE services SET url = 'https://rustfs.noahsark.me' WHERE id = 'rustfs' AND url = 'https://s3.noahsark.me:9001'`;
}

export { sql, migrate };
export default sql;
