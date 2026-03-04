# Cockpit — Homelab Dashboard

## Project Overview

Cockpit is a self-hosted homelab dashboard that provides a single pane of glass for managing infrastructure, services, and personal tools. It's a full-stack TypeScript monorepo deployed to a k3s Kubernetes cluster via GitLab CI/CD.

The project serves as Chris's central command center for his homelab, consolidating service monitoring, container management, Proxmox VM control, Kubernetes cluster visibility, cron job scheduling, network Wake-on-LAN, bookmark management, markdown document editing, and more — all behind a single authenticated dark-themed UI at `dashboard.noahsark.me`.

## Architecture

### Monorepo Structure

```
cockpit/
├── apps/
│   ├── api/                  # Backend: Bun + Hono REST API (port 4000)
│   │   └── src/
│   │       ├── index.ts      # Main entry, route mounting, WebSocket handler
│   │       ├── auth.ts       # Session auth (httpOnly cookies, SQLite sessions)
│   │       └── db.ts         # SQLite setup, migrations, seed data
│   └── web/                  # Frontend: React 19 + Vite 6 SPA
│       └── src/
│           ├── main.tsx      # App entry, routing, auth gate
│           ├── Layout.tsx    # Sidebar navigation, responsive shell
│           ├── api.ts        # Fetch wrapper with auth handling
│           ├── pages/        # 13 page components (one per module + dashboard + login)
│           └── components/   # Shared: ErrorBanner, ConfirmDialog, LoadingSpinner, PageHeader, StatusBadge
├── modules/                  # 11 feature modules (each has api.ts with Hono routes)
│   ├── homelab/              # Service monitoring + multi-host Docker management
│   ├── bookmarks/            # Bookmarks with tags, search, import/export
│   ├── markdown/             # Markdown editor with WebSocket real-time collaboration
│   ├── graph/                # Canvas force-directed knowledge graph
│   ├── sysmon/               # k8s cluster monitor (nodes, pods, metrics)
│   ├── proxmox/              # Proxmox VE node/VM/CT management
│   ├── logs/                 # Container + system log viewer
│   ├── cron/                 # Cron job manager with execution history
│   ├── wol/                  # Wake-on-LAN device management
│   ├── dedup/                # File deduplicator (hash-based)
│   └── randomizer/           # Project idea generator with favorites
├── Dockerfile.api            # API container (oven/bun:1)
├── Dockerfile.web            # Web container (Vite build → nginx static)
├── .gitlab-ci.yml            # 5-stage CI/CD: lint → test → version → build → deploy
├── bun.lock                  # Dependency lockfile
└── CLAUDE.md                 # This file
```

### Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 3.4, Lucide icons, React Router 7
- **Backend:** Bun, Hono, SQLite (WAL mode, foreign keys)
- **Auth:** Session-based with httpOnly secure cookies, 24h expiry
- **Real-time:** Bun native WebSocket (markdown collaboration)
- **Styling:** Custom dark nautical theme (`cockpit-*` Tailwind tokens — gold accent #c8913a on dark #0c1118)
- **Build:** Kaniko (rootless, no DinD) in GitLab CI
- **Deploy:** kubectl rolling updates to k3s cluster
- **Registry:** GitLab Container Registry (gitlab.noahsark.me:5050)

### Routes

| Path | Page | Module |
|------|------|--------|
| `/` | Dashboard | Overview cards, recent items |
| `/homelab` | Homelab | Service monitor + Docker containers |
| `/bookmarks` | Bookmarks | Tag-based bookmark manager |
| `/markdown` | Markdown | Editor with live preview |
| `/markdown/:id` | Markdown | Specific document |
| `/graph` | Graph | Knowledge graph visualization |
| `/monitor` | System Monitor | k8s cluster metrics |
| `/proxmox` | Proxmox | VM/CT management |
| `/logs` | Logs | Container/system log viewer |
| `/cron` | Cron Jobs | Scheduled task manager |
| `/wol` | Wake-on-LAN | Network device wake |
| `/dedup` | Dedup | File deduplication |
| `/randomizer` | Randomizer | Project idea generator |

### Infrastructure

- **k3s cluster:** 3 masters (10.0.80.141-143), 3 workers (10.0.80.151-153, 4 vCPU / 24GB RAM each)
- **VIP:** 10.0.80.200 (kube-vip), MetalLB external: 10.0.80.210
- **Storage:** Longhorn (3 replicas, default StorageClass)
- **Ingress:** nginx Ingress Controller + cert-manager (Let's Encrypt, Cloudflare DNS-01)
- **DNS:** Cloudflare → dashboard.noahsark.me → MetalLB → nginx Ingress → services
- **GitLab:** gitlab.noahsark.me (10.0.80.73), project: ctmarsh/cockpit
- **MinIO:** s3.noahsark.me (10.0.80.211, native TLS via cert-manager)
- **Proxmox:** pve.noahsark.me:8006

### Kubernetes Namespace: cockpit

- `deployment/cockpit-api` — 1 replica, Recreate strategy (RWO PVC), startupProbe (5 min window), no memory limit (Bun JIT needs 4GB+)
- `deployment/cockpit-web` — 2 replicas, RollingUpdate, ConfigMap nginx.conf override for k8s service names
- `service/cockpit-api` — ClusterIP:4000
- `service/cockpit-web` — ClusterIP:80
- `ingress/cockpit` — TLS via cert-manager

## GitLab Workflow Rules

### Git

- **Default remote is `gitlab`** — there is no `origin`. Never try `git push origin`.
- **Always push to `gitlab` remote:** `git push gitlab master`
- The `github` remote exists as a mirror but is not the primary — do not push there unless Chris explicitly asks.

### Issues

- **Create GitLab issues BEFORE implementing any feature, fix, or enhancement.** This is non-negotiable.
- Every issue must have: a descriptive title, a `## Problem` or `## Description` section, relevant labels, and a milestone assignment.
- Reference issue numbers in commit messages (e.g., `Fix #75` or `Closes #75`).
- Add a resolution comment when closing issues explaining what was done.

### Labels

Use these labels (avoid creating duplicates):

| Label | Purpose |
|-------|---------|
| `bug` | Bug fix |
| `enhancement` | Improvement to existing feature |
| `feature` | New functionality |
| `security` | Security-related |
| `documentation` | Docs, wiki, README |
| `infrastructure` | k8s, CI/CD, deployment |
| `ui` | Frontend/visual changes |
| `quick-fix` | Can be done in < 30 minutes |
| `priority::high` | Do first |
| `priority::medium` | Do when possible |
| `priority::low` | Nice to have |

### Milestones

- Group related issues under version milestones (v2.2.0, v2.3.0, etc.)
- Close milestones when all issues are resolved and deployed.
- Create a GitLab Release with changelog for every version that gets deployed.

### Releases

- The CI/CD pipeline auto-bumps patch versions (v2.1.15 → v2.1.16) on every push to master.
- After deployment, create a GitLab Release for the new tag with a summary of changes.
- For major/minor bumps, create the tag manually before pushing.

### Wiki

- Update the GitLab Wiki after any significant deployment or architectural change.
- Key pages: Home, Architecture, Modules, CI/CD Pipeline, Roadmap, Development Guide, API Reference, Infrastructure.
- The Roadmap page should reflect current milestone progress.

### Merge Requests (future)

- Currently pushing directly to master. When branch protection is enabled, use feature branches named `feature/{issue-number}-short-description` or `fix/{issue-number}-short-description`.

## Key Rules (NON-NEGOTIABLE)

1. **Version on login page must match GitLab releases** — the `APP_VERSION` env var flows from CI auto-version → build arg → runtime.
2. **Never expose internal IPs to public DNS** — all internal services stay on 10.0.80.x.
3. **Never use Google DNS (8.8.8.8)** — Cloudflare (1.1.1.1) only, everywhere.
4. **Request permission before any k3s cluster changes** — do not modify deployments, services, RBAC, or cluster config without Chris's approval.
5. **Proxmox VM CPU type must be "host"** — not "Common KVM processor" — Bun crashes with SIGILL otherwise.

## Development

### Local Setup

```bash
bun install
# API
COCKPIT_USER=admin COCKPIT_PASS=yourpass bun run apps/api/src/index.ts
# Web (separate terminal)
cd apps/web && bun run dev
```

### Adding a New Module

1. Create `modules/{name}/api.ts` with Hono routes
2. Import and mount in `apps/api/src/index.ts`
3. Add DB migrations in `apps/api/src/db.ts` if needed
4. Create `apps/web/src/pages/{Name}.tsx`
5. Add route in `apps/web/src/main.tsx`
6. Add sidebar nav item in `apps/web/src/Layout.tsx`
7. Create GitLab issue and assign to milestone FIRST

### Type Checking

```bash
bunx tsc --noEmit -p apps/web/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
```

### CI/CD Pipeline Stages

1. **lint** — TypeScript type check (API + Web)
2. **test** — Start API server, run `bun test apps/api/src/`
3. **version** — Auto-bump patch tag, export APP_VERSION
4. **build** — Kaniko builds API + Web images, push to registry
5. **deploy** — kubectl set image + rollout status on k3s

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COCKPIT_USER` | Yes | `admin` | Login username |
| `COCKPIT_PASS` | Yes | `cockpit` | Login password |
| `SESSION_SECRET` | Yes | — | Session encryption |
| `API_PORT` | No | `4000` | API server port |
| `APP_VERSION` | No | `unknown` | Version displayed in UI + health |
| `KUBECONFIG` | For sysmon | — | k8s cluster access |
| `PROXMOX_HOST` | For proxmox | — | Proxmox API URL |
| `PROXMOX_TOKEN_ID` | For proxmox | — | Proxmox API token ID |
| `PROXMOX_TOKEN_SECRET` | For proxmox | — | Proxmox API token secret |

## Coding Patterns

- **API routes:** Hono router per module, mounted at `/api/{module}` in index.ts
- **State:** React useState + useEffect, no external state management
- **Styling:** Tailwind utility classes with `cockpit-*` theme tokens only
- **Errors:** `ErrorBanner` component for page-level errors, `ConfirmDialog` for destructive actions
- **Data fetching:** `api<T>(path, options)` wrapper in `apps/web/src/api.ts` handles auth + error checking
- **Icons:** Lucide React exclusively — no other icon libraries
