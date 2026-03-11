# Cockpit

[![Pipeline Status](https://gitlab.noahsark.me/ctmarsh/cockpit/badges/master/pipeline.svg)](https://gitlab.noahsark.me/ctmarsh/cockpit/-/pipelines)

**NoahsArk Command Center** — A self-hosted homelab dashboard for monitoring, managing, and organizing infrastructure from a single pane of glass.

## Platform Support

| Platform | Status | Tech |
|----------|--------|------|
| Web Dashboard | Production (v2.5.52) | React 19 + Vite 6 |
| iOS App | TestFlight | Swift 6 + SwiftUI |
| watchOS App | TestFlight | watchOS 11+ |

## Features (20 Modules)

### Infrastructure Management
- **Homelab Monitor** — Docker container and service monitoring with health checks
- **k3s Cluster Manager** — Workloads, pods, logs, scaling, events
- **System Monitor** — Cluster-level node metrics and resource usage
- **Proxmox VE** — VM and container management via API
- **Home Assistant** — Proxy integration with SSE bridge

### Operations & Monitoring
- **Alerts** — Configurable alert rules with threshold monitoring
- **Log Viewer** — Container and system log aggregation with search
- **Cron Manager** — Scheduled task management with execution history
- **Deploy History** — Deployment tracking and rollback visibility
- **MinIO Browser** — S3-compatible object storage management

### Networking & Notifications
- **Wake-on-LAN** — Network device wake management
- **Notifications** — Push notification management via Notify service

### Development Tools
- **GitLab** — Repository, pipeline, and merge request dashboard
- **Bookmark Manager** — Tag-based bookmarks with search and import/export
- **Markdown Editor** — Real-time collaborative editing via WebSocket
- **Knowledge Graph** — Force-directed canvas visualization
- **File Deduplicator** — Hash-based duplicate file detection
- **Project Randomizer** — Idea generator with favorites

### Data Management
- **Backup Manager** — Automated backup monitoring and S3 storage
- **Dashboard** — Aggregated overview with module cards and stats

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 3.4, Lucide icons
- **Backend:** Bun, Hono, SQLite (WAL mode, foreign keys)
- **Mobile:** Swift 6, SwiftUI, iOS 26+, WidgetKit, App Intents, SpriteKit
- **Watch:** watchOS 11+, standalone cellular, device code login
- **Auth:** Session-based with httpOnly secure cookies (24h expiry)
- **Real-time:** Bun native WebSocket (markdown collaboration), SSE (Home Assistant, logs)
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
| `KUBECONFIG` | For k8s | — | Path to k8s cluster kubeconfig |
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
│           └── pages/    # 20 page components
├── modules/              # 22 feature modules
│   ├── alerts/           # Alert rules + threshold monitoring
│   ├── backup/           # Automated backup to MinIO S3
│   ├── bookmarks/        # Bookmark manager
│   ├── cron/             # Cron job manager
│   ├── dedup/            # File deduplicator
│   ├── deploy-history/   # Deployment tracking
│   ├── gitlab/           # GitLab integration
│   ├── graph/            # Knowledge graph
│   ├── homeassistant/    # Home Assistant proxy + SSE
│   ├── homelab/          # Service monitor + Docker
│   ├── k8s/              # k3s cluster manager
│   ├── k8s-client/       # Shared k8s API client
│   ├── logs/             # Log viewer
│   ├── markdown/         # Markdown editor + WebSocket
│   ├── minio/            # MinIO S3 browser
│   ├── notify/           # Push notification proxy
│   ├── proxmox/          # Proxmox VE management
│   ├── randomizer/       # Project idea generator
│   ├── s3-client/        # Shared S3 client
│   ├── sysmon/           # System/cluster monitor
│   ├── tls-config/       # TLS configuration helper
│   └── wol/              # Wake-on-LAN
├── ios/                  # iOS + watchOS native apps
├── Dockerfile.api        # API container (oven/bun:1)
├── Dockerfile.web        # Web container (Vite build → nginx)
└── .gitlab-ci.yml        # 5-stage CI/CD pipeline
```

### Routes

| Path | Module | Description |
|------|--------|-------------|
| `/` | Dashboard | Overview cards, recent items, stats |
| `/homelab` | Homelab | Service monitor + Docker containers |
| `/bookmarks` | Bookmarks | Tag-based bookmark manager |
| `/markdown` | Markdown | Editor with live preview |
| `/graph` | Graph | Knowledge graph visualization |
| `/monitor` | System Monitor | k8s cluster metrics |
| `/proxmox` | Proxmox | VM/CT management |
| `/homeassistant` | Home Assistant | Smart home dashboard |
| `/k8s` | k3s Manager | Workloads, pods, logs, scaling |
| `/alerts` | Alerts | Alert rules and history |
| `/logs` | Logs | Container/system log viewer |
| `/cron` | Cron Jobs | Scheduled task manager |
| `/wol` | Wake-on-LAN | Network device wake |
| `/dedup` | Dedup | File deduplication |
| `/randomizer` | Randomizer | Project idea generator |
| `/minio` | MinIO | S3 object browser |
| `/notify` | Notify | Push notification management |
| `/gitlab` | GitLab | Repository and pipeline dashboard |

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
- **Ingress** — Traefik with TLS via cert-manager (Let's Encrypt, Cloudflare DNS-01)
- **PVC** — Longhorn storage for SQLite database

### CI/CD Pipeline

The GitLab CI/CD pipeline runs on every push to `master`:

1. **Lint** — TypeScript type checking (API + Web) in parallel
2. **Test** — API server startup + test suite
3. **Version** — Auto-bump patch tag (e.g., v2.5.51 → v2.5.52)
4. **Build** — Kaniko container image builds (API + Web)
5. **Deploy** — kubectl rolling update to k3s

Security scanning (SAST + Secret Detection) runs on all branches and merge requests.

### iOS / watchOS

- Built with Fastlane + XcodeGen
- Code signing via match (Git-based)
- Distributed via TestFlight
- CI triggers on changes to `ios/` directory

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
