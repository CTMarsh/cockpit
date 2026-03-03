# Contributing to Cockpit

Thank you for your interest in contributing to Cockpit! This guide covers the development workflow, conventions, and processes for making changes.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Git](https://git-scm.com/)

### Getting Started

```bash
git clone git@gitlab.noahsark.me:ctmarsh/cockpit.git
cd cockpit
bun install
bun run dev
```

This starts both the API server (`localhost:4000`) and the Vite dev server (`localhost:5173`) concurrently.

## Project Architecture

Cockpit is a **Bun monorepo** organized into three workspace categories:

```
apps/       → Application entry points (api, web)
modules/    → Feature modules (backend logic per feature)
packages/   → Shared utilities (if needed)
```

### Adding a New Module

1. Create the module directory:
   ```
   modules/your-module/
   ├── api.ts          # Hono router with endpoints
   └── package.json    # Workspace package definition
   ```

2. Define the package:
   ```json
   {
     "name": "@cockpit/your-module",
     "version": "2.1.0",
     "private": true
   }
   ```

3. Create the API router:
   ```typescript
   import { Hono } from "hono";

   export const yourModuleRoutes = new Hono();

   yourModuleRoutes.get("/health", (c) =>
     c.json({ status: "ok", module: "your-module" })
   );

   // Add your endpoints...
   ```

4. Register in `apps/api/src/index.ts`:
   ```typescript
   import { yourModuleRoutes } from "../../../modules/your-module/api";
   app.route("/api/your-module", yourModuleRoutes);
   ```

5. Add the frontend page in `apps/web/src/pages/YourModule.tsx`

6. Register the route in `apps/web/src/main.tsx` and add the sidebar entry in `apps/web/src/Layout.tsx`

7. Add the COPY line to `Dockerfile.api` for the module's `package.json`

## Code Conventions

### Backend (API)

- Use [Hono](https://hono.dev) routers for all API endpoints
- Each module exports a single `*Routes` Hono instance
- Use `bun:sqlite` for database operations — define tables in the module's `api.ts`
- All endpoints live under `/api/{module-name}/`
- Every module must have a `/health` endpoint
- Use prepared statements for database queries

### Frontend (Web)

- React functional components with hooks
- Tailwind CSS with the `cockpit-*` custom theme tokens
- Use `lucide-react` for icons
- Use the shared `api()` helper from `src/api.ts` for API calls
- Pages go in `src/pages/` with PascalCase naming

### General

- TypeScript throughout — no `any` unless interfacing with external APIs
- Keep modules self-contained — no cross-module imports
- SQLite tables are created inline in each module (no migration system)

## Git Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation changes

### Commit Messages

Follow conventional format:

```
v{version}: Brief description of changes

Detailed explanation if needed.

Closes #{issue-number}
```

### Rules

1. **Every commit bumps the version number** in `package.json`
2. **Every task gets a GitLab issue** before work begins
3. **Commits reference issues** with `Closes #N`
4. **Issues get time tracking** (`/spend Xh`) and status updates
5. **Milestones group related work** for releases
6. **GitLab Wiki is updated** when new features are added

## Deployment

Cockpit deploys via GitLab CI/CD:

```
git push gitlab master → Pipeline: lint → build → deploy (LXC 113)
```

The pipeline builds Docker images, pushes to the LXC, and runs `docker compose up -d --force-recreate`.

## Docker

### Building Locally

```bash
docker compose build
docker compose up -d
```

### Services

- **api** — Bun API server on port 4000
- **web** — Nginx serving the React build on port 3000 (proxied to 80)

### Volumes

- `cockpit-data` — Persistent SQLite database and markdown files at `/app/data`

## Reporting Issues

Use [GitLab Issues](https://gitlab.noahsark.me/ctmarsh/cockpit/-/issues) to report bugs or request features. Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser/environment details
- Screenshots if applicable
