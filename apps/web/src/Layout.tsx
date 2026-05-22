import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Server,
  Bookmark,
  HardDrive,
  Shuffle,
  FileText,
  Network,
  Activity,
  MonitorDot,
  ScrollText,
  Clock,
  Power,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Box,
  Home,
  Bell,
  BellRing,
  Database,
  GitMerge,
  HardDriveDownload,
  History,
  Signal,
  ShieldCheck,
  Route,
  Globe,
  Wifi,
  Terminal,
} from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "": "Dashboard",
  homelab: "Homelab",
  bookmarks: "Bookmarks",
  dedup: "Deduplicator",
  randomizer: "Build Ideas",
  markdown: "Markdown",
  graph: "Knowledge Graph",
  monitor: "Cluster Monitor",
  proxmox: "Proxmox",
  logs: "Log Viewer",
  cron: "Cron Jobs",
  wol: "Wake-on-LAN",
  k8s: "k3s Cluster",
  homeassistant: "Home Assistant",
  alerts: "Alert Rules",
  s3: "S3 Browser",
  notify: "Notifications",
  gitlab: "GitLab",
  backups: "Backups",
  deploys: "Deploy History",
  uptime: "Uptime Monitor",
  certificates: "Certificates",
  traefik: "Traefik Routes",
  dns: "DNS Manager",
  network: "Network Scanner",
  ansible: "Ansible Runner",
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-ark-text-muted mb-4">
      <NavLink to="/" className="hover:text-ark-text transition-colors">Dashboard</NavLink>
      {segments.map((seg, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const label = ROUTE_LABELS[seg] || decodeURIComponent(seg);
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center gap-1.5">
            <span className="opacity-40">/</span>
            {isLast ? (
              <span className="text-ark-text">{label}</span>
            ) : (
              <NavLink to={path} className="hover:text-ark-text transition-colors">{label}</NavLink>
            )}
          </span>
        );
      })}
    </nav>
  );
}

const modules = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/homelab", label: "Homelab", icon: Server },
  { path: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { path: "/dedup", label: "Deduplicator", icon: HardDrive },
  { path: "/randomizer", label: "Build Ideas", icon: Shuffle },
  { path: "/markdown", label: "Markdown", icon: FileText },
  { path: "/graph", label: "Knowledge Graph", icon: Network },
  { path: "/monitor", label: "Cluster Monitor", icon: Activity },
  { path: "/proxmox", label: "Proxmox", icon: MonitorDot },
  { path: "/logs", label: "Log Viewer", icon: ScrollText },
  { path: "/cron", label: "Cron Jobs", icon: Clock },
  { path: "/wol", label: "Wake-on-LAN", icon: Power },
  { path: "/k8s", label: "k3s Cluster", icon: Box },
  { path: "/homeassistant", label: "Home Assistant", icon: Home },
  { path: "/alerts", label: "Alert Rules", icon: Bell },
  { path: "/notify", label: "Notifications", icon: BellRing },
  { path: "/s3", label: "S3 Browser", icon: Database },
  { path: "/gitlab", label: "GitLab", icon: GitMerge },
  { path: "/backups", label: "Backups", icon: HardDriveDownload },
  { path: "/deploys", label: "Deploy History", icon: History },
  { path: "/uptime", label: "Uptime Monitor", icon: Signal },
  { path: "/certificates", label: "Certificates", icon: ShieldCheck },
  { path: "/traefik", label: "Traefik Routes", icon: Route },
  { path: "/dns", label: "DNS Manager", icon: Globe },
  { path: "/network", label: "Network Scanner", icon: Wifi },
  { path: "/ansible", label: "Ansible Runner", icon: Terminal },
];

export function Layout({ onLogout }: { onLogout?: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cockpit-sidebar-collapsed") === "true");
  const [healthStatus, setHealthStatus] = useState<"ok" | "degraded" | "down">("ok");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Poll API health every 30s
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health", { credentials: "include" });
        setHealthStatus(res.ok ? "ok" : "degraded");
      } catch {
        setHealthStatus("down");
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut: ? to toggle help overlay
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setShowShortcuts((prev) => !prev);
    }
    if (e.key === "Escape" && showShortcuts) {
      setShowShortcuts(false);
    }
  }, [showShortcuts]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem("cockpit-sidebar-collapsed", String(!prev));
      return !prev;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout?.();
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`border-b border-ark-border ${collapsed ? "p-3 lg:flex lg:justify-center" : "p-5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/ark-icon.jpg"
              alt="Ark"
              className="w-9 h-9 rounded-ark shrink-0 ring-1 ring-ark-warm/25 shadow-[0_0_14px_0_var(--ark-warm-bg)]"
            />
            <div className={collapsed ? "lg:hidden" : ""}>
              <h1 className="text-[17px] font-bold tracking-tight text-ark-text-bright">Cockpit</h1>
              <p className="text-[11px] text-ark-warm font-semibold uppercase tracking-[0.06em]">NoahsArk</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-ark-text-muted hover:text-ark-text p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? "p-2" : "p-3"} space-y-0.5 overflow-y-auto`}>
        {modules.map((mod) => (
          <NavLink
            key={mod.path}
            to={mod.path}
            end={mod.path === "/"}
            title={mod.label}
            className={({ isActive }) =>
              `flex items-center gap-3 ${collapsed ? "lg:justify-center lg:px-2" : "px-3"} py-2.5 rounded-ark text-sm font-medium transition-all duration-ark-fast ${
                isActive
                  ? "bg-ark-primary-bg text-ark-primary border border-ark-primary/30"
                  : "text-ark-text-muted hover:text-ark-text-bright hover:bg-ark-text-bright/5 border border-transparent"
              }`
            }
          >
            <mod.icon className="w-4 h-4 shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>{mod.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex border-t border-ark-border p-2 justify-center">
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-ark text-ark-text-muted hover:text-ark-text-bright hover:bg-ark-text-bright/5 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer */}
      <div className={`border-t border-ark-border ${collapsed ? "p-2" : "p-4"}`}>
        <div className={`flex items-center ${collapsed ? "lg:justify-center" : "justify-between"}`}>
          <div className={`text-xs text-ark-text-muted ${collapsed ? "lg:hidden" : ""}`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              healthStatus === "ok" ? "bg-ark-success" : healthStatus === "degraded" ? "bg-ark-warm" : "bg-ark-danger"
            }`} />
            {healthStatus === "ok" ? "All systems nominal" : healthStatus === "degraded" ? "Service degraded" : "API unreachable"}
          </div>
          {collapsed && (
            <span
              className={`hidden lg:inline-block w-2 h-2 rounded-full ${
                healthStatus === "ok" ? "bg-ark-success" : healthStatus === "degraded" ? "bg-ark-warm" : "bg-ark-danger"
              }`}
              title={healthStatus === "ok" ? "All systems nominal" : healthStatus === "degraded" ? "Service degraded" : "API unreachable"}
            />
          )}
          <button
            onClick={handleLogout}
            className={`text-ark-text-muted hover:text-ark-danger transition-colors ${collapsed ? "lg:hidden" : ""}`}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className={`text-[10px] text-ark-text-dim mt-1.5 ${collapsed ? "lg:hidden" : ""}`}>v{__APP_VERSION__}</div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-ark-surface border-b border-ark-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="text-ark-text-muted hover:text-ark-text-bright">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/ark-icon.jpg" alt="Ark" className="w-7 h-7 rounded-ark-sm" />
          <span className="font-bold text-sm text-ark-text-bright">Cockpit</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: slide-in overlay */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 ${collapsed ? "lg:w-16" : "lg:w-64"} bg-ark-surface border-r border-ark-border
          flex flex-col shrink-0
          transform transition-all duration-ark ease-ark
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-ark-surface border border-ark-border-strong rounded-ark-xl p-6 max-w-md w-full shadow-ark-modal pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-ark-text-bright">Keyboard shortcuts</h3>
                <button onClick={() => setShowShortcuts(false)} className="text-ark-text-muted hover:text-ark-text-bright">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="text-[11px] text-ark-text-muted uppercase font-semibold tracking-[0.04em]">Global</div>
                {[
                  ["?", "Toggle this help"],
                  ["Esc", "Close overlay / modal"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-ark-text-muted">{desc}</span>
                    <kbd className="px-2 py-0.5 bg-ark-bg border border-ark-border rounded text-xs font-mono text-ark-text">{key}</kbd>
                  </div>
                ))}
                <div className="text-[11px] text-ark-text-muted uppercase font-semibold tracking-[0.04em] mt-4">Markdown editor</div>
                {[
                  ["Ctrl+B", "Bold"],
                  ["Ctrl+I", "Italic"],
                  ["Ctrl+S", "Save document"],
                  ["Ctrl+Shift+P", "Toggle preview"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-ark-text-muted">{desc}</span>
                    <kbd className="px-2 py-0.5 bg-ark-bg border border-ark-border rounded text-xs font-mono text-ark-text">{key}</kbd>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-ark-text-muted text-center">
                Press <kbd className="px-1.5 py-0.5 bg-ark-bg border border-ark-border rounded text-[10px] font-mono">?</kbd> to close
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
