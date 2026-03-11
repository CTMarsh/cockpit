# Changelog

All notable changes to Cockpit are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.52] - 2026-03-11

### Added
- **GitLab Module** — Web UI, iOS app, and Apple Watch integration for repository, pipeline, and issue management

## [2.5.51] - 2026-03-11

### Changed
- **Watch Navigation** — Proper vertical page navigation per Apple Human Interface Guidelines

## [2.5.50] - 2026-03-10

### Fixed
- **Keychain Access** — Add shared group to iPhone entitlements for watch communication

### Changed
- **Watch UI** — Replace vertical page tabs with NavigationStack list menu

## [2.5.49] - 2026-03-10

### Fixed
- **Face ID Toggle** — Fix biometric authentication toggle behavior
- **Link Apple Watch** — Add Link Apple Watch option to Settings

## [2.5.48] - 2026-03-10

### Added
- **Device Code Login** — Scan-free authentication via 6-character code for Apple Watch

## [2.5.47] - 2026-03-10

### Added
- **Watch Standalone Auth** — Login view and Keychain isolation for watchOS independent operation

## [2.5.46] - 2026-03-10

### Fixed
- **Watch JSON Decoding** — Remove convertFromSnakeCase strategy that broke API parsing

## [2.5.45] - 2026-03-10

### Changed
- **CI Triggers** — Include CockpitWatch and WidgetExtension in iOS build change triggers
- **XcodeGen** — Add comment to project.yml to trigger iOS build

## [2.5.44] - 2026-03-10

### Fixed
- **Watch Complication** — Remove optional chaining on UserDefaults.standard that caused compile errors

## [2.5.43] - 2026-03-10

### Changed
- **Watch Caching** — Remove App Groups entitlement, use standard UserDefaults for caching

## [2.5.42] - 2026-03-10

### Fixed
- **Watch App** — Add Keychain auth, correct API paths, auth-aware error handling

## [2.5.41] - 2026-03-10

### Fixed
- **iOS Audit** — Fix 19 issues across networking, auth, views, and services

## [2.5.40] - 2026-03-10

### Fixed
- **Watch Embedding** — Add CockpitWatch as embedded dependency of CockpitApp for TestFlight

## [2.5.39] - 2026-03-09

### Changed
- Trigger iOS rebuild with version fix in CI pipeline

## [2.5.38] - 2026-03-09

### Fixed
- **iOS Version** — deploy:testflight needs version job artifacts for APP_VERSION

## [2.5.37] - 2026-03-09

### Changed
- Trigger iOS rebuild with version sync from CI pipeline

## [2.5.36] - 2026-03-09

### Fixed
- **Version Display** — Fix "vunknown" by syncing APP_VERSION from CI to API deployment and iOS app

## [2.5.35] - 2026-03-09

### Changed
- Revert match to readonly mode now that all provisioning profiles are created

## [2.5.34] - 2026-03-09

### Fixed
- **watchOS Entitlements** — Remove App Groups and Keychain Sharing from watchOS entitlements

## [2.5.33] - 2026-03-09

### Fixed
- **Match** — Remove invalid watchos platform option, use single match call

## [2.5.32] - 2026-03-09

### Fixed
- **watchOS Signing** — Fix code signing with separate match for watchOS platform and explicit profile assignment

## [2.5.31] - 2026-03-09

### Fixed
- Enable match to create watchOS provisioning profile in CI

## [2.5.30] - 2026-03-09

### Added
- **watchOS Embedding** — Embed watchOS app in iOS IPA via scheme and Fastlane signing

## [2.5.29] - 2026-03-09

### Fixed
- **Blank Screens** — Fix blank screens on k3s Manager, Cluster Monitor, and Proxmox views

## [2.5.28] - 2026-03-08

### Added
- **watchOS App** — Apple Watch companion app with standalone cellular mode
- **Shared Components** — iOS shared components and enhanced module views
- **Export Compliance** — Add export compliance flag and watch app icon

### Changed
- Seed homelab services with real infrastructure URLs
- Fix Infrastructure tab modules and dashboard version display

## [2.5.27] - 2026-03-08

### Fixed
- **iOS Infrastructure** — Fix Infrastructure tab modules and dashboard version display

## [2.5.26] - 2026-03-08

### Fixed
- **iOS Full Audit** — Fix models, services, views across 21 files

## [2.5.25] - 2026-03-08

### Fixed
- **Widget Extension** — Add NSExtension dict to widget Info.plist properties in project.yml

## [2.5.24] - 2026-03-08

### Fixed
- **Widget Info.plist** — Fix widget extension Info.plist and build number for TestFlight

## [2.5.23] - 2026-03-08

### Fixed
- **TestFlight Build** — Fix build number auto-increment for TestFlight submissions

## [2.5.22] - 2026-03-08

### Fixed
- **iOS Model Audit** — Fix model/service mismatches from module audit

## [2.5.21] - 2026-03-08

### Fixed
- Remove CarPlay entitlement from project.yml (xcodegen source of truth)

## [2.5.20] - 2026-03-08

### Changed
- Remove CarPlay entitlement pending Apple approval

## [2.5.19] - 2026-03-08

### Added
- **iOS SSE Pod Logs** — Real-time pod log streaming on iOS
- **Graph Zoom/Pan** — Pinch zoom and pan gestures on knowledge graph
- **Markdown Collab** — Live collaboration on iOS markdown editor

## [2.5.18] - 2026-03-07

### Added
- **CarPlay** — CarPlay interface (pending Apple approval)
- **iOS Extensions** — Share extension, settings screen
- **VMControl Intent** — Siri intent for VM start/stop
- **Haptics** — Tactile feedback throughout iOS app
- **SSE** — Server-sent events on iOS

## [2.5.17] - 2026-03-07

### Added
- **iOS v1.0.0** — Complete native SwiftUI app
  - WidgetKit home screen widgets with background refresh
  - Push notifications for CI build status
  - Cockpit app icon (ark with dashboard gauge)
  - iOS CI/CD pipeline (verify, build, TestFlight deploy)
  - Siri Shortcuts via App Intents
  - SpriteKit force-directed knowledge graph
  - Two-tier offline cache
  - Real-time SSE and WebSocket support
  - Deep linking for all modules
  - All 18 infrastructure screens
  - Core modules: Bookmarks, Proxmox, WoL, Sysmon, Cron, Randomizer
  - SwiftUI foundation with biometric auth

### Changed
- Update CI kubectl image to alpine/k8s:1.35.2 for k3s v1.35.2

## [2.5.16] - 2026-03-07

### Added
- **iOS v1.0.0** — Native SwiftUI Cockpit App (full feature set)

## [2.5.15] - 2026-03-07

### Added
- **iOS v0.1.0** — Native SwiftUI app foundation

## [2.5.14] - 2026-03-07

### Fixed
- Version bump (pipeline maintenance)

## [2.5.13] - 2026-03-07

### Fixed
- **CI Pipeline** — Fix duplicate pipelines and broken kubectl image

## [2.5.12] - 2026-03-07

### Changed
- **CI Optimization** — Pipeline best practices and hardening

## [2.5.11] - 2026-03-06

### Fixed
- **TLS Verification** — Re-enable TLS verification on internal services (Fix #126)

## [2.5.10] - 2026-03-06

### Security
- Fix 12 vulnerabilities (2 critical, 2 high, 8 medium) in security hardening round

## [2.5.9] - 2026-03-06

### Changed
- **CLAUDE.md** — Update with active MR workflow rules

## [2.5.8] - 2026-03-06

### Added
- **Device Management UI** — Toggle, delete, edit, test push, environment badges for notify devices

## [2.5.7] - 2026-03-05

### Fixed
- **Notify Proxy** — Wrap API responses to match frontend expectations

## [2.5.6] - 2026-03-05

### Added
- **Notifications Module** — Push notification management with Notify service integration

## [2.5.5] - 2026-03-05

### Changed
- **README** — Update to reflect current k3s architecture and all features

## [2.5.4] - 2026-03-05

### Security
- **CI/CD Hardening** — Security scanning (SAST + Secret Detection), rules migration, test enforcement (#105-#113)

## [2.5.3] - 2026-03-04

### Security
- Fix 7 additional input validation vulnerabilities from post-fix audit

## [2.5.2] - 2026-03-04

### Security
- Fix 11 vulnerabilities (4 critical, 4 high, 3 medium) — command injection, SSRF, path traversal

## [2.5.1] - 2026-03-04

### Fixed
- Version bump (pipeline maintenance)

## [2.5.0] - 2026-03-04

### Added
- **Backup Manager** — Automated backups to MinIO S3 with health monitoring
- **Alert Rules** — Configurable alert thresholds with notification integration
- **Deploy History** — Deployment tracking with timeline view
- **MinIO Browser** — S3-compatible object storage browser

## [2.4.0] - 2026-03-05

### Added
- **Home Assistant Integration** — Proxy API, SSE bridge, real-time entity state dashboard

## [2.3.0] - 2026-03-05

### Added
- **k3s Cluster Manager** — Full Kubernetes management: workloads, pods, logs, scaling, events

## [2.2.1] - 2026-03-04

### Fixed
- Version bump (pipeline maintenance)

## [2.2.0] - 2026-03-04

### Added
- **Sidebar Health Status** — Live health indicators in sidebar navigation
- **Keyboard Shortcuts** — Global keyboard shortcuts for module navigation
- **Sparklines** — Mini charts on dashboard cards showing trends
- **Breadcrumbs** — Navigation breadcrumb trail
- **Toast Notifications** — Non-blocking notification system
- **Collapsible Sidebar** — Toggle sidebar for more screen space
- **Dashboard Stats Cards** — Aggregated statistics on dashboard

### Fixed
- Security vulnerabilities in error handling
- Graph layout bugs

## [2.1.18] - 2026-03-04

### Added
- Toast notifications, collapsible sidebar, dashboard stats cards

## [2.1.17] - 2026-03-04

### Added
- Comprehensive CLAUDE.md with project documentation and GitLab workflow rules

## [2.1.16] - 2026-03-04

### Fixed
- Security, error handling, and graph layout bugs

## [2.1.15] - 2026-03-03

### Fixed
- Version bump (pipeline maintenance)

## [2.1.14] - 2026-03-03

### Fixed
- Version bump (pipeline maintenance)

## [2.1.13] - 2026-03-03

### Fixed
- Version bump (pipeline maintenance)

## [2.1.12] - 2026-03-03

### Fixed
- Version bump (pipeline maintenance)

## [2.1.11] - 2026-03-03

### Fixed
- Graph test endpoints and assertions to match actual API (#72)

## [2.1.10] - 2026-03-03

### Fixed
- CI test stage — start API server before running tests (#71)

## [2.1.9] - 2026-03-03

### Added
- **Polish** — Confirm dialogs, accessibility improvements, responsive graph, loading spinner (#66-#70)

## [2.1.8] - 2026-03-03

### Fixed
- **Cluster Monitor** — Add Proxmox env vars, k8s RBAC, remove hostPID (#65)

## [2.1.7] - 2026-03-03

### Added
- **Shared Components** — ErrorBanner, PageHeader, StatusBadge reusable components (#60-#64)

## [2.1.6] - 2026-03-03

### Changed
- **Performance** — Dockerignore, nginx compression/caching, useMemo optimizations (#54-#59)

## [2.1.5] - 2026-03-03

### Security
- Command injection, SSRF, and path traversal fixes (#47-#53)

## [2.1.4] - 2026-03-03

### Changed
- **System Monitor** — Redesigned as Cluster Monitor for k8s workloads

## [2.1.3] - 2026-03-03

### Added
- **CI Test Stage** — Automated testing and error states across all pages (#45, #46)

## [2.1.2] - 2026-03-03

### Fixed
- Strip `v` prefix from version string — UI already adds it

## [2.1.1] - 2026-03-02

### Added
- **k3s Migration** — Kubernetes manifests, GitLab agent config, k3s CI/CD pipeline
- **Kaniko Builds** — Rootless container image builds (no Docker-in-Docker)
- **Auto-Version Pipeline** — Automatic patch version bumping in CI
- **Dashboard Grid** — Improved layout with deploy timeout handling

### Fixed
- TypeScript errors, strict lint, k8s runner values
- nginx ConfigMap, API probes, TLS ingress, CI deploy image
- Remove ineffective k8s agent block from deploy job

### Changed
- Remove legacy LXC deploy job (k3s migration complete)
- Add Kaniko layer caching for faster CI builds
- Move login box inward with margin-right

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
