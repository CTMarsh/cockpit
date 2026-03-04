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
  Database,
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
  minio: "MinIO Browser",
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-cockpit-text-muted mb-4">
      <NavLink to="/" className="hover:text-cockpit-text transition-colors">Dashboard</NavLink>
      {segments.map((seg, i) => {
        const path = "/" + segments.slice(0, i + 1).join("/");
        const label = ROUTE_LABELS[seg] || decodeURIComponent(seg);
        const isLast = i === segments.length - 1;
        return (
          <span key={path} className="flex items-center gap-1.5">
            <span className="opacity-40">/</span>
            {isLast ? (
              <span className="text-cockpit-text">{label}</span>
            ) : (
              <NavLink to={path} className="hover:text-cockpit-text transition-colors">{label}</NavLink>
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
  { path: "/minio", label: "MinIO Browser", icon: Database },
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
      <div className={`border-b border-cockpit-border ${collapsed ? "p-3 lg:flex lg:justify-center" : "p-5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/ark-icon.jpg"
              alt="Ark"
              className="w-9 h-9 rounded-lg shadow-sm"
            />
            <div className={collapsed ? "lg:hidden" : ""}>
              <h1 className="text-lg font-bold tracking-tight">Cockpit</h1>
              <p className="text-xs text-cockpit-text-muted">NoahsArk</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-cockpit-text-muted hover:text-cockpit-text p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? "p-2" : "p-3"} space-y-1 overflow-y-auto`}>
        {modules.map((mod) => (
          <NavLink
            key={mod.path}
            to={mod.path}
            end={mod.path === "/"}
            title={mod.label}
            className={({ isActive }) =>
              `flex items-center gap-3 ${collapsed ? "lg:justify-center lg:px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/20"
                  : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <mod.icon className="w-4 h-4 shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>{mod.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex border-t border-cockpit-border p-2 justify-center">
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-lg text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Footer */}
      <div className={`border-t border-cockpit-border ${collapsed ? "p-2" : "p-4"}`}>
        <div className={`flex items-center ${collapsed ? "lg:justify-center" : "justify-between"}`}>
          <div className={`text-xs text-cockpit-text-muted ${collapsed ? "lg:hidden" : ""}`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              healthStatus === "ok" ? "bg-cockpit-success" : healthStatus === "degraded" ? "bg-cockpit-accent" : "bg-cockpit-danger"
            }`} />
            {healthStatus === "ok" ? "All systems nominal" : healthStatus === "degraded" ? "Service degraded" : "API unreachable"}
          </div>
          {collapsed && (
            <span
              className={`hidden lg:inline-block w-2 h-2 rounded-full ${
                healthStatus === "ok" ? "bg-cockpit-success" : healthStatus === "degraded" ? "bg-cockpit-accent" : "bg-cockpit-danger"
              }`}
              title={healthStatus === "ok" ? "All systems nominal" : healthStatus === "degraded" ? "Service degraded" : "API unreachable"}
            />
          )}
          <button
            onClick={handleLogout}
            className={`text-cockpit-text-muted hover:text-cockpit-danger transition-colors ${collapsed ? "lg:hidden" : ""}`}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className={`text-[10px] text-cockpit-text-muted/40 mt-1.5 ${collapsed ? "lg:hidden" : ""}`}>v{__APP_VERSION__}</div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-cockpit-surface border-b border-cockpit-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(true)} className="text-cockpit-text-muted hover:text-cockpit-text">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/ark-icon.jpg" alt="Ark" className="w-7 h-7 rounded-md" />
          <span className="font-bold text-sm">Cockpit</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: slide-in overlay */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 ${collapsed ? "lg:w-16" : "lg:w-64"} bg-cockpit-surface border-r border-cockpit-border
          flex flex-col shrink-0
          transform transition-all duration-200 ease-in-out
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
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setShowShortcuts(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
                <button onClick={() => setShowShortcuts(false)} className="text-cockpit-text-muted hover:text-cockpit-text">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-cockpit-text-muted uppercase font-medium tracking-wider">Global</div>
                {[
                  ["?", "Toggle this help"],
                  ["Esc", "Close overlay / modal"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-cockpit-text-muted">{desc}</span>
                    <kbd className="px-2 py-0.5 bg-cockpit-bg border border-cockpit-border rounded text-xs font-mono">{key}</kbd>
                  </div>
                ))}
                <div className="text-xs text-cockpit-text-muted uppercase font-medium tracking-wider mt-4">Markdown Editor</div>
                {[
                  ["Ctrl+B", "Bold"],
                  ["Ctrl+I", "Italic"],
                  ["Ctrl+S", "Save document"],
                  ["Ctrl+Shift+P", "Toggle preview"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-cockpit-text-muted">{desc}</span>
                    <kbd className="px-2 py-0.5 bg-cockpit-bg border border-cockpit-border rounded text-xs font-mono">{key}</kbd>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-cockpit-text-muted text-center">
                Press <kbd className="px-1.5 py-0.5 bg-cockpit-bg border border-cockpit-border rounded text-[10px] font-mono">?</kbd> to close
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
