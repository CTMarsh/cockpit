# Cockpit — Homelab Dashboard

## Project Overview

Cockpit is a self-hosted homelab dashboard deployed to a k3s cluster via GitLab CI/CD and ArgoCD GitOps. It provides a single pane of glass for managing infrastructure, services, and personal tools at `dashboard.noahsark.me`.

## Architecture

### Monorepo Structure

```
cockpit/
├── apps/
│   ├── api/                  # Backend: Bun + Hono REST API (port 4000)
│   │   └── src/
│   │       ├── index.ts      # Main entry, 25 route mounts, WebSocket, OpenAPI docs
│   │       ├── auth.ts       # Session auth (httpOnly cookies, PostgreSQL sessions, device code QR flow)
│   │       ├── db.ts         # PostgreSQL setup, migrations, seed data
│   │       ├── redis.ts      # Redis Sentinel HA client (pub/sub for cross-pod WebSocket)
│   │       ├── index.test.ts # Integration tests (auth, CRUD, health checks)
│   │       └── schemas/      # Shared Zod schemas
│   └── web/                  # Frontend: React 19 + Vite 6 SPA
│       └── src/
│           ├── main.tsx      # App entry, 27 routes + auth gate
│           ├── Layout.tsx    # Sidebar navigation, responsive shell
│           ├── api.ts        # Fetch wrapper with credentials + 401 handling
│           ├── pages/        # 28 page components
│           └── components/   # Shared: ErrorBanner, ConfirmDialog, LoadingSpinner, PageHeader, StatusBadge, Toast
├── modules/                  # 25 feature modules (each has api.ts with Hono routes)
│   ├── homelab/              # Service monitoring with SSRF protection
│   ├── bookmarks/            # Bookmarks with tags, search, import/export
│   ├── markdown/             # Markdown editor with WebSocket real-time collaboration
│   ├── graph/                # Force-directed knowledge graph
│   ├── sysmon/               # k8s cluster monitor (nodes, pods, metrics via Proxmox + k8s APIs)
│   ├── proxmox/              # Proxmox VE node/VM/CT management
│   ├── logs/                 # k8s pod log viewer with SSE streaming
│   ├── cron/                 # Cron job manager with Bun.spawn execution
│   ├── wol/                  # Wake-on-LAN device management
│   ├── k8s/                  # Kubernetes workload management (restart/scale/delete)
│   ├── homeassistant/        # Home Assistant entity states + service calling
│   ├── alerts/               # Alert rules with Notify webhook integration
│   ├── uptime/               # Uptime service monitoring + stats
│   ├── certificates/         # cert-manager Certificate/Issuer viewer
│   ├── traefik/              # IngressRoute/Middleware viewer
│   ├── dns/                  # Cloudflare DNS record management
│   ├── network/              # Network device scanning + port discovery
│   ├── ansible/              # Playbook execution + run history
│   ├── backup/               # S3/MinIO backup management
│   ├── deploy-history/       # Deployment event log
│   ├── s3-browser/           # MinIO/S3 bucket/file browser
│   ├── notify/               # Notify service proxy with cookie caching
│   ├── gitlab/               # Full GitLab API proxy
│   ├── dedup/                # File deduplication by hash
│   ├── randomizer/           # Project idea generator with favorites
│   ├── k8s-client/           # Shared k8s API client (Bearer token, streaming)
│   ├── s3-client/            # Shared MinIO/S3 client
│   └── tls-config/           # pveTls() + k8sTls() for self-signed certs
├── ios/                      # iOS app (Swift 6, iOS 26+, XcodeGen + fastlane)
├── Dockerfile.api            # API container (oven/bun:1)
├── Dockerfile.web            # Web container (Vite build → nginx:1.27-alpine)
├── .gitlab-ci.yml            # CI/CD: lint → test → version → build → deploy
└── CLAUDE.md                 # This file
```

### Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 3.4, Lucide icons, React Router 7
- **Backend:** Bun, Hono 4.12+ (OpenAPIHono with Zod validation), Scalar API docs
- **Database:** PostgreSQL 16 via CNPG (CloudNativePG) — 3-instance HA cluster (`cockpit-pg`)
- **Cache/Pub-Sub:** Redis 7 Sentinel HA (3-node StatefulSet, auto-failover)
- **Auth:** Session-based with httpOnly secure cookies, 24h expiry, DB-backed rate limiting, device code QR flow
- **Real-time:** Bun native WebSocket + Redis pub/sub for cross-pod markdown collaboration
- **Styling:** Custom dark nautical theme (`cockpit-*` Tailwind tokens — gold accent #c8913a on dark #0c1118)
- **Build:** Kaniko (rootless, no DinD) in GitLab CI
- **Deploy:** ArgoCD GitOps — CI commits image tags to `k8s-manifests` repo, ArgoCD syncs to cluster
- **Secrets:** HashiCorp Vault → External Secrets Operator (ESO) → Kubernetes Secrets
- **Ingress:** Traefik v3.6.11 IngressRoute CRDs with cross-namespace middlewares
- **TLS:** cert-manager with Let's Encrypt (DNS-01 via Cloudflare)
- **Registry:** GitLab Container Registry (gitlab.noahsark.me:5050)

### Routes

| Path | Page | Module |
|------|------|--------|
| `/` | Dashboard | Overview cards, recent items, cluster health |
| `/homelab` | Homelab | Service monitoring with uptime sparklines |
| `/bookmarks` | Bookmarks | Tag-based bookmark manager with import/export |
| `/markdown` | Markdown | Editor with live preview |
| `/markdown/:id` | Markdown | Specific document (WebSocket collab) |
| `/graph` | Graph | Knowledge graph visualization (D3) |
| `/monitor` | System Monitor | k8s cluster metrics via Proxmox + k8s APIs |
| `/proxmox` | Proxmox | VM/CT management |
| `/logs` | Logs | k8s pod log viewer with SSE streaming |
| `/cron` | Cron Jobs | Scheduled task manager |
| `/wol` | Wake-on-LAN | Network device wake |
| `/k8s` | K8s Manager | Namespace/workload/pod management |
| `/homeassistant` | Home Assistant | Entity states + service calling |
| `/alerts` | Alerts | Alert rules + history |
| `/uptime` | Uptime Monitor | HTTP uptime tracking + stats |
| `/certificates` | Certificates | cert-manager Certificate/Issuer viewer |
| `/traefik` | Traefik Routes | IngressRoute/Middleware viewer |
| `/dns` | DNS Manager | Cloudflare DNS record management |
| `/network` | Network Scanner | Device scanning + port discovery |
| `/ansible` | Ansible Runner | Playbook execution |
| `/s3` | S3 Browser | MinIO/S3 bucket/file browser |
| `/notify` | Notify | Notification service management |
| `/gitlab` | GitLab | Projects, MRs, pipelines, jobs, releases |
| `/backups` | Backups | S3 backup management |
| `/deploys` | Deploy History | Deployment event log |
| `/dedup` | Dedup | File deduplication |
| `/randomizer` | Randomizer | Project idea generator |
| `/link` | Link Device | QR-based device linking |

### Infrastructure

- **k3s cluster:** 4 masters (10.0.80.141-144), 3 workers (10.0.80.151-153)
- **VIP:** 10.0.80.200 (kube-vip), MetalLB external: 10.0.80.210
- **Storage:** Longhorn (3 replicas default), longhorn-nvme on master-4
- **Ingress:** Traefik v3.6.11 IngressRoute CRDs + cert-manager (Let's Encrypt, Cloudflare DNS-01)
- **DNS:** Cloudflare → dashboard.noahsark.me → MetalLB → Traefik → services
- **GitOps:** ArgoCD watches `k8s-manifests` repo — sole write path to cluster
- **Secrets:** Vault → ESO → k8s Secrets (cockpit-secrets ExternalSecret extracts all env vars)
- **GitLab:** gitlab.noahsark.me (10.0.80.73), project: ctmarsh/cockpit (ID: 33)

### Kubernetes Namespace: cockpit

- `deployment/cockpit-api` — 2 replicas, RollingUpdate, securityContext (runAsNonRoot, drop ALL), limits (1 cpu / 2Gi)
- `deployment/cockpit-web` — 2 replicas, RollingUpdate, ConfigMap nginx.conf
- `statefulset/cockpit-redis` — 3 replicas, Sentinel HA with auto-failover
- `cluster/cockpit-pg` — CNPG PostgreSQL 16.13, 3 instances, 20Gi Longhorn storage, Barman backups
- `service/cockpit-api` — ClusterIP:4000
- `service/cockpit-web` — ClusterIP:80
- `ingressroute/cockpit` — Traefik IngressRoute with cross-namespace middlewares (rate-limit, security-headers)
- NetworkPolicies — zero-trust (default-deny ingress, explicit allows)
- PodDisruptionBudgets — api (minAvailable: 1), web (minAvailable: 1), redis (minAvailable: 2)
- RBAC — cockpit-api ServiceAccount + cockpit-manager ClusterRole (pods, deployments, cert-manager, traefik CRDs, metrics)

## GitLab Workflow Rules

### Git

- **Default remote is `gitlab`** — never push to `origin`.
- **Bot account:** cockpit-bot (Developer role) — cannot push to master directly
- **Branch protection:** master is protected, only Maintainers can push/merge

### Issues

- **Create GitLab issues BEFORE implementing any feature, fix, or enhancement.**
- Reference issue numbers in commit messages (e.g., `Fix #75` or `Closes #75`).

### Labels

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

### Merge Requests

- Use feature branches: `feature/{issue}-description` or `fix/{issue}-description`
- **Always set Assignee to cockpit-bot (id=5) and Reviewer to ctmarsh (id=1)**
- Chris reviews and merges — never merge via API

## Key Rules (NON-NEGOTIABLE)

1. **ArgoCD is the sole write path to the cluster** — no `kubectl apply`, no direct cluster mutations
2. **k8s-manifests repo is the sole source for all cluster manifests** — no manifests stored in cockpit repo
3. **Never expose internal IPs to public DNS**
4. **Never use Google DNS (8.8.8.8)** — Cloudflare (1.1.1.1) only
5. **Request permission before any k3s cluster changes**
6. **Proxmox VM CPU type must be "host"** — Bun crashes with SIGILL otherwise

## Development

### Local Setup

```bash
bun install
# Start postgres + redis + api + web
docker compose up -d postgres redis
COCKPIT_USER=admin COCKPIT_PASS=yourpass DATABASE_URL=postgres://cockpit:cockpit@localhost:5432/cockpit REDIS_URL=redis://localhost:6379 bun run apps/api/src/index.ts
cd apps/web && bun run dev
```

### Type Checking

```bash
bunx tsc --noEmit -p apps/web/tsconfig.json
bunx tsc --noEmit -p apps/api/tsconfig.json
```

### CI/CD Pipeline Stages

1. **lint** — TypeScript type check (API + Web)
2. **test** — Start API server with postgres + redis services, run `bun test apps/api/src/`
3. **version** — Auto-bump patch tag, export APP_VERSION
4. **build** — Kaniko builds API + Web images → GitLab registry
5. **deploy** — Commit image tags to k8s-manifests repo (ArgoCD syncs)
6. **release** — Auto-create GitLab Release on ISC branch merge

### Environment Variables

All env vars come from `cockpit-secrets` ExternalSecret (Vault path: `cockpit/cockpit-secrets`).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `COCKPIT_USER` | Yes | Login username |
| `COCKPIT_PASS` | Yes | Login password |
| `REDIS_SENTINEL_HOSTS` | Prod | Sentinel host:port pairs (comma-separated) |
| `REDIS_SENTINEL_MASTER` | Prod | Sentinel master name (cockpit-master) |
| `REDIS_URL` | Dev | Direct Redis URL for local dev |
| `PVE_URL` | For proxmox/sysmon | Proxmox VE API URL |
| `PVE_TOKEN` | For proxmox/sysmon | Proxmox API token |
| `GITLAB_URL` | For gitlab | GitLab instance URL |
| `GITLAB_TOKEN` | For gitlab | GitLab API token |
| `HA_URL` | For homeassistant | Home Assistant URL |
| `HA_TOKEN` | For homeassistant | Home Assistant API token |
| `NOTIFY_URL` | For notify/alerts | Notify service URL |
| `NOTIFY_ADMIN_USER` | For notify | Notify admin username |
| `NOTIFY_ADMIN_PASS` | For notify | Notify admin password |
| `NOTIFY_ALERT_SLUG` | For alerts | Notify webhook slug |
| `NOTIFY_ALERT_API_KEY` | For alerts | Notify webhook API key |
| `CLOUDFLARE_API_TOKEN` | For dns | Cloudflare API token |
| `CLOUDFLARE_ZONE_ID` | For dns | Cloudflare zone ID |
| `S3_ENDPOINT` | For backup/s3 | MinIO/S3 endpoint |
| `S3_ACCESS_KEY` | For backup/s3 | MinIO/S3 access key |
| `S3_SECRET_KEY` | For backup/s3 | MinIO/S3 secret key |
| `ANSIBLE_REPO_PATH` | For ansible | Ansible playbook path |
| `ANSIBLE_SSH_HOST` | For ansible | SSH host for playbooks |
| `ANSIBLE_SSH_KEY` | For ansible | SSH key for playbooks |
| `API_PORT` | No | API server port (default: 4000) |
| `APP_VERSION` | No | Version (CI-injected) |
| `NODE_ENV` | No | Set to `production` in k8s deployment |

## Coding Patterns

- **API routes:** OpenAPIHono router per module, mounted at `/api/{module}` in index.ts
- **State:** React useState + useEffect, no external state management
- **Styling:** Tailwind utility classes with `cockpit-*` theme tokens only
- **Errors:** `ErrorBanner` component for page-level errors, `ConfirmDialog` for destructive actions
- **Data fetching:** `api<T>(path, options)` wrapper handles auth + error checking
- **Icons:** Lucide React exclusively
- **Database:** `postgres` library with tagged template literals (parameterized queries)
- **WebSocket:** Bun native WebSocket with Redis pub/sub for cross-pod broadcast
