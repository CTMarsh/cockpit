# Cockpit

**NoahsArk Command Center** — A self-hosted homelab dashboard for monitoring, managing, and organizing your infrastructure.

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Runtime](https://img.shields.io/badge/runtime-Bun-f472b6)

## Overview

Cockpit is a modular dashboard built with Bun, Hono, React, and SQLite. It provides a unified interface for managing homelab services, bookmarks, documents, virtual machines, scheduled tasks, and more — all from a single, clean UI.

## Modules

| Module | Description | Endpoint |
|--------|-------------|----------|
| **Dashboard** | Aggregated overview with stats and recent activity | `/` |
| **Homelab** | Monitor Docker containers and services | `/homelab` |
| **Bookmarks** | Save, tag, and search URLs | `/bookmarks` |
| **Markdown** | Collaborative document editor with live preview | `/markdown` |
| **Knowledge Graph** | Visualize connections between documents and bookmarks | `/graph` |
| **Deduplicator** | Find and manage duplicate files | `/dedup` |
| **Build Ideas** | Random project idea generator | `/randomizer` |
| **System Monitor** | Real-time CPU, memory, disk, and process monitoring | `/monitor` |
| **Proxmox** | Manage VMs and containers on Proxmox VE | `/proxmox` |
| **Log Viewer** | Stream container and system logs | `/logs` |
| **Cron Jobs** | Create and manage scheduled tasks | `/cron` |
| **Wake-on-LAN** | Wake machines remotely via magic packets | `/wol` |

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **API Framework:** [Hono](https://hono.dev)
- **Database:** SQLite (via `bun:sqlite`)
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Auth:** Session-based with cookie authentication
- **Deployment:** Docker Compose on Proxmox LXC

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Development

```bash
# Clone the repository
git clone git@gitlab.noahsark.me:ctmarsh/cockpit.git
cd cockpit

# Copy environment file
cp .env.example .env

# Install dependencies
bun install

# Start development servers (API + Web)
bun run dev
```

The API runs on `http://localhost:4000` and the web UI on `http://localhost:5173`.

### Docker Deployment

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f
```

The web UI is available on port `3000` and the API on port `4000`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API server port | `4000` |
| `COCKPIT_USER` | Login username | `admin` |
| `COCKPIT_PASS` | Login password | `cockpit` |
| `SESSION_SECRET` | Cookie signing secret | `change-me` |
| `DOCKER_HOST` | Docker Engine API URL | `http://host.docker.internal:2375` |
| `PROC_ROOT` | Host `/proc` mount path | `/host/proc` |
| `PVE_URL` | Proxmox VE API URL | _(optional)_ |
| `PVE_TOKEN` | Proxmox API token (`user!tokenid=uuid`) | _(optional)_ |

## Project Structure

```
cockpit/
├── apps/
│   ├── api/              # Hono API server
│   │   └── src/
│   │       ├── index.ts  # Entry point & route registration
│   │       ├── auth.ts   # Authentication middleware
│   │       └── db.ts     # SQLite database initialization
│   └── web/              # React frontend
│       └── src/
│           ├── main.tsx   # Router & entry point
│           ├── Layout.tsx # Sidebar & shell
│           └── pages/     # Page components per module
├── modules/              # Feature modules (backend)
│   ├── homelab/          # Docker service monitoring
│   ├── bookmarks/        # URL bookmarking
│   ├── markdown/         # Document editor
│   ├── graph/            # Knowledge graph
│   ├── dedup/            # File deduplication
│   ├── randomizer/       # Idea generator
│   ├── sysmon/           # System monitoring
│   ├── proxmox/          # Proxmox VE integration
│   ├── logs/             # Log streaming
│   ├── cron/             # Job scheduler
│   └── wol/              # Wake-on-LAN
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.web
└── package.json
```

## API

All API endpoints are prefixed with `/api` and require authentication (except `/api/auth/*`).

```bash
# Health check
curl http://localhost:4000/api/health

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"cockpit"}'

# Example: List bookmarks (with session cookie)
curl http://localhost:4000/api/bookmarks -b cookies.txt
```

Each module exposes its own health endpoint at `/api/{module}/health`.

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
