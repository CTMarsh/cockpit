# Changelog

All notable changes to Cockpit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-03-03

### Added
- **Proxmox Dashboard** — Monitor Proxmox VE nodes, VMs, and containers with start/stop/reboot actions
- **Log Viewer** — Stream Docker container logs and system journal with search, filtering, and severity highlighting
- **Cron Job Manager** — Create, schedule, and monitor recurring tasks with cron expression support and execution history
- **Wake-on-LAN** — Save devices and send magic packets to wake machines remotely with online status checking
- NET_ADMIN capability for WoL UDP broadcast support

### Changed
- Bumped module count from 7 to 11
- Updated Dashboard with cards for all new modules
- Updated sidebar navigation with new module entries

## [2.0.1] - 2026-03-02

### Fixed
- Minor deployment and configuration fixes
- GitLab CI/CD pipeline improvements

## [2.0.0] - 2026-03-02

### Added
- **Dashboard** — Aggregated overview with module cards, recent bookmarks, and recent documents
- **Homelab Monitor** — Docker container and service monitoring with health checks
- **Bookmarks Manager** — Save, tag, search, import/export URLs
- **Markdown Editor** — Collaborative document editor with live preview and WebSocket sync
- **Knowledge Graph** — Interactive visualization of document and bookmark connections
- **Deduplicator** — File scanning and duplicate detection with hash comparison
- **Build Ideas** — Random project idea generator with tech stack combinations
- **System Monitor** — Real-time CPU, memory, disk, network, and process monitoring
- Session-based authentication with login/logout
- Responsive sidebar layout with mobile support
- Docker Compose deployment with persistent SQLite storage
- GitLab CI/CD pipeline (lint, build, deploy to Proxmox LXC)

### Technical
- Bun monorepo with workspaces (`apps/*`, `modules/*`, `packages/*`)
- Hono API framework with middleware (CORS, logging, auth)
- React 19 + Vite + Tailwind CSS frontend
- SQLite via `bun:sqlite` for zero-dependency persistence
