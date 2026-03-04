import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
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
} from "lucide-react";

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
];

export function Layout({ onLogout }: { onLogout?: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cockpit-sidebar-collapsed") === "true");
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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
            <span className="inline-block w-2 h-2 rounded-full bg-cockpit-success mr-2" />
            All systems nominal
          </div>
          {collapsed && <span className="hidden lg:inline-block w-2 h-2 rounded-full bg-cockpit-success" title="All systems nominal" />}
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}
