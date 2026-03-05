# Cockpit

[![Pipeline Status](https://gitlab.noahsark.me/ctmarsh/cockpit/badges/master/pipeline.svg)](https://gitlab.noahsark.me/ctmarsh/cockpit/-/pipelines)

**NoahsArk Command Center** — A self-hosted homelab dashboard for monitoring, managing, and organizing infrastructure from a single pane of glass.

## Features

- **Service Monitoring** — Health checks across multiple Docker hosts
- **Docker Management** — Start, stop, restart containers across hosts
- **Proxmox VE** — VM and container management via API
- **Kubernetes Monitor** — Node status, pod metrics, cluster health
- **Home Assistant** — Proxy integration with SSE bridge
- **Bookmark Manager** — Tag-based bookmarks with search and import/export
- **Markdown Editor** — Real-time collaborative editing via WebSocket
- **Knowledge Graph** — Force-directed canvas visualization
- **Log Viewer** — Container and system log aggregation
- **Cron Manager** — Scheduled task management with execution history
- **Wake-on-LAN** — Network device wake management
- **File Deduplicator** — Hash-based duplicate file detection
- **Project Randomizer** — Idea generator with favorites
- **Backup Management** — Automated backup monitoring and alerts
- **Deploy History** — Deployment tracking and rollback visibility

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 3.4, Lucide icons
- **Backend:** Bun, Hono, SQLite (WAL mode, foreign keys)
- **Auth:** Session-based with httpOnly secure cookies (24h expiry)
- **Real-time:** Bun native WebSocket (markdown collaboration)
- **Build:** Kaniko (rootless, no DinD) via GitLab CI/CD
- **Deploy:** kubectl rolling updates to k3s cluster
- **Registry:** GitLab Container Registry

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+

### Local Development

```bash
# Clone the repository
git clone git@gitlab.noahsark.me:ctmarsh/cockpit.git
cd cockpit

# Install dependencies
bun install

# Start API server (terminal 1)
COCKPIT_USER=admin COCKPIT_PASS=yourpass SESSION_SECRET=dev-secret bun run apps/api/src/index.ts

# Start web dev server (terminal 2)
cd apps/web && bun run dev
```

The API runs on `http://localhost:4000` and the web UI on `http://localhost:5173`.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COCKPIT_USER` | Yes | `admin` | Login username |
| `COCKPIT_PASS` | Yes | `cockpit` | Login password |
| `SESSION_SECRET` | Yes | — | Session encryption key |
| `API_PORT` | No | `4000` | API server port |
| `APP_VERSION` | No | `unknown` | Version displayed in UI and health endpoint |
| `KUBECONFIG` | For sysmon | — | Path to k8s cluster kubeconfig |
| `PROXMOX_HOST` | For proxmox | — | Proxmox API URL (e.g., `https://pve.example.com:8006`) |
| `PROXMOX_TOKEN_ID` | For proxmox | — | Proxmox API token ID |
| `PROXMOX_TOKEN_SECRET` | For proxmox | — | Proxmox API token secret |
| `HA_TOKEN` | For homeassistant | — | Home Assistant long-lived access token |

## Architecture

### Monorepo Structure

```
cockpit/
├── apps/
│   ├── api/              # Bun + Hono REST API (port 4000)
│   │   └── src/
│   │       ├── index.ts  # Entry, route mounting, WebSocket
│   │       ├── auth.ts   # Session auth (httpOnly cookies)
│   │       └── db.ts     # SQLite setup, migrations
│   └── web/              # React 19 + Vite 6 SPA
│       └── src/
│           ├── main.tsx  # Entry, routing, auth gate
│           ├── Layout.tsx # Sidebar navigation
│           ├── api.ts    # Fetch wrapper with auth
│           └── pages/    # Page components
├── modules/              # Feature modules (each has api.ts routes)
│   ├── homelab/          # Service monitor + Docker management
│   ├── bookmarks/        # Bookmark manager
│   ├── markdown/         # Markdown editor with WebSocket
│   ├── graph/            # Knowledge graph
│   ├── sysmon/           # k8s cluster monitor
│   ├── proxmox/          # Proxmox VE management
│   ├── logs/             # Log viewer
│   ├── cron/             # Cron job manager
│   ├── wol/              # Wake-on-LAN
│   ├── dedup/            # File deduplicator
│   └── randomizer/       # Project idea generator
├── Dockerfile.api        # API container (oven/bun:1)
├── Dockerfile.web        # Web container (Vite build → nginx)
└── .gitlab-ci.yml        # 5-stage CI/CD pipeline
```

### Routes

| Path | Module | Description |
|------|--------|-------------|
| `/` | Dashboard | Overview cards, recent items |
| `/homelab` | Homelab | Service monitor + Docker containers |
| `/bookmarks` | Bookmarks | Tag-based bookmark manager |
| `/markdown` | Markdown | Editor with live preview |
| `/graph` | Graph | Knowledge graph visualization |
| `/monitor` | System Monitor | k8s cluster metrics |
| `/proxmox` | Proxmox | VM/CT management |
| `/logs` | Logs | Container/system log viewer |
| `/cron` | Cron Jobs | Scheduled task manager |
| `/wol` | Wake-on-LAN | Network device wake |
| `/dedup` | Dedup | File deduplication |
| `/randomizer` | Randomizer | Project idea generator |

### Adding a New Module

1. Create `modules/{name}/api.ts` with Hono routes
2. Mount in `apps/api/src/index.ts`
3. Add DB migrations in `apps/api/src/db.ts` if needed
4. Create `apps/web/src/pages/{Name}.tsx`
5. Add route in `apps/web/src/main.tsx`
6. Add sidebar nav item in `apps/web/src/Layout.tsx`

## Deployment

### Kubernetes (k3s)

The application deploys to a k3s cluster with the following resources in the `cockpit` namespace:

- **cockpit-api** — Deployment (1 replica, Recreate strategy for RWO PVC)
- **cockpit-web** — Deployment (2 replicas, RollingUpdate)
- **Services** — ClusterIP for both API (4000) and Web (80)
- **Ingress** — TLS via cert-manager (Let's Encrypt, Cloudflare DNS-01)
- **PVC** — Longhorn storage for SQLite database

### CI/CD Pipeline

The GitLab CI/CD pipeline runs on every push to `master`:

1. **Lint** — TypeScript type checking (API + Web) in parallel with tests
2. **Test** — API server startup + test suite
3. **Version** — Auto-bump patch tag (e.g., v2.5.3 → v2.5.4)
4. **Build** — Kaniko container image builds (API + Web)
5. **Deploy** — kubectl rolling update to k3s

Security scanning (SAST + Secret Detection) runs on all branches and merge requests.

### Type Checking

```bash
# API
bunx tsc --noEmit -p apps/api/tsconfig.json

# Web
bunx tsc --noEmit -p apps/web/tsconfig.json
```

## API

All API endpoints are prefixed with `/api` and require authentication (except `/api/auth/*` and `/api/health`).

```bash
# Health check
curl http://localhost:4000/api/health

# Login
curl -c cookies.txt -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpass"}'

# Example: List bookmarks (with session cookie)
curl -b cookies.txt http://localhost:4000/api/bookmarks
```

## Design

- **Theme:** Dark nautical with gold accent (`#c8913a` on `#0c1118`)
- **Styling:** Tailwind CSS with custom `cockpit-*` theme tokens
- **Icons:** Lucide React exclusively
- **Shared Components:** ErrorBanner, ConfirmDialog, LoadingSpinner, PageHeader, StatusBadge

## License

This project is licensed under the MIT License.
