# App Store Connect / TestFlight — Copy-Paste Metadata

Use this document to fill in all fields in App Store Connect. Each section maps to a specific field.

---

## App Information

**Name:**
```
Cockpit - Homelab Dashboard
```

**Subtitle:**
```
Control Your Infrastructure
```

**Primary Category:**
```
Utilities
```

**Secondary Category:**
```
Developer Tools
```

**Content Rights:**
```
This app does not contain, show, or access third-party content.
```

---

## Pricing & Availability

**Price:** Free

**Availability:** All territories

---

## App Privacy (App Store Privacy Details)

**Data Collection:**
```
Yes — Device ID (App Functionality only, not linked to identity, not used for tracking)
```

**Data Linked to You:** None

**Data Used to Track You:** None

**Privacy Policy URL:**
```
https://dashboard.noahsark.me/privacy
```

**Detailed Responses:**

| Question | Answer |
|----------|--------|
| Do you or your third-party partners collect data from this app? | Yes |
| Data type collected | Device ID |
| Is this data linked to the user's identity? | No |
| Is this data used for tracking purposes? | No |
| Purpose | App Functionality |

---

## Version Information (TestFlight / App Store)

**Version:** 1.1.0

**What's New (Release Notes):**
```
v1.1.0:
- Added 6 new modules: Uptime Monitor, Certificate Monitor, Traefik Routes, DNS Manager, Network Scanner, Ansible Runner
- Fixed Face ID authentication debounce preventing duplicate prompts
- All 28 web modules now have full iOS counterparts
- Improved navigation with updated Infrastructure and Operations tabs
```

**Promotional Text:**
```
Your entire homelab in your pocket. Monitor, manage, and control 28 infrastructure modules from anywhere.
```

**Description:**
```
Cockpit is a self-hosted homelab dashboard that gives you complete control over your infrastructure from your iPhone and Apple Watch.

INFRASTRUCTURE AT YOUR FINGERTIPS
Monitor Docker containers, manage Proxmox VMs, check Kubernetes cluster health, and control Home Assistant devices — all from a single, beautifully designed dark-themed interface.

28 MODULES, ONE APP
- Homelab Monitor: Real-time Docker container status and health checks
- k3s Cluster Manager: Workloads, pods, scaling, and events
- Proxmox VE: Start, stop, and manage VMs and containers
- Uptime Monitor: Service health polling with response time tracking
- Certificate Monitor: TLS certificate expiry tracking
- Network Scanner: TCP port scanning and device discovery
- DNS Manager: Cloudflare DNS record management
- Traefik Routes: Ingress routes and middleware visibility
- Ansible Runner: Execute playbooks with dry-run support
- And 19 more modules for complete homelab control

BUILT FOR SPEED
Face ID authentication gets you in instantly. Pull-to-refresh on every screen. Real-time updates via Server-Sent Events and WebSocket connections.

APPLE WATCH COMPANION
Check cluster status and service health from your wrist with the standalone watchOS app. No iPhone required.

WIDGETS & SHORTCUTS
WidgetKit home screen widgets for at-a-glance monitoring. Siri Shortcuts for hands-free cluster and service health checks.

PRIVACY FIRST
Cockpit connects directly to your self-hosted dashboard. No cloud services, no third-party analytics, no data collection. Your infrastructure, your data.
```

**Keywords:**
```
homelab,dashboard,kubernetes,docker,proxmox,monitoring,infrastructure,server,selfhosted,devops
```

---

## URLs

**Marketing URL:**
```
https://dashboard.noahsark.me
```

**Support URL:**
```
https://gitlab.noahsark.me/ctmarsh/cockpit/-/issues
```

**Privacy Policy URL:**
```
https://dashboard.noahsark.me/privacy
```

---

## App Review Information

**Contact First Name:**
```
Chris
```

**Contact Last Name:**
```
Marsh
```

**Contact Email:**
```
ctmarsh@gmail.com
```

**Notes for Review:**
```
This app connects to a self-hosted server (homelab dashboard) at a user-configured URL. The app requires a running instance of Cockpit (https://github.com/ctmarsh/cockpit) on the user's own infrastructure.

To test: The app will show a login screen. Without access to a running Cockpit server, the app will display connection errors — this is expected behavior as it is designed for self-hosted use only.

No demo account is available as the server runs on private infrastructure. The app does not collect or transmit user data to any third-party services.
```

---

## Age Rating

| Question | Answer |
|----------|--------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Simulated Gambling | None |
| Unrestricted Web Access | No |
| Gambling and Contests | None |

**Expected Rating:** 4+

---

## Screenshots

Screenshots need to be captured from Xcode Simulator on macOS. Required sizes:

| Device | Resolution | Required |
|--------|-----------|----------|
| iPhone 16 Pro Max (6.9") | 1320 x 2868 | Yes |
| iPhone 16 Pro (6.3") | 1206 x 2622 | Yes |
| iPhone SE (4.7") | 750 x 1334 | Optional |

**Recommended screenshot screens (in order):**
1. Dashboard — shows module grid overview
2. Homelab — Docker container monitoring
3. System Monitor — k8s cluster health
4. Proxmox — VM/CT management
5. Uptime Monitor — service health status
6. Apple Watch — watchOS companion app

> **Note:** Screenshots must be captured on a macOS machine with Xcode installed. Use `xcrun simctl` to boot the simulator and capture screenshots.
