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
} from "lucide-react";

const modules = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/homelab", label: "Homelab", icon: Server },
  { path: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { path: "/dedup", label: "Deduplicator", icon: HardDrive },
  { path: "/randomizer", label: "Build Ideas", icon: Shuffle },
  { path: "/markdown", label: "Markdown", icon: FileText },
  { path: "/graph", label: "Knowledge Graph", icon: Network },
  { path: "/monitor", label: "System Monitor", icon: Activity },
  { path: "/proxmox", label: "Proxmox", icon: MonitorDot },
  { path: "/logs", label: "Log Viewer", icon: ScrollText },
  { path: "/cron", label: "Cron Jobs", icon: Clock },
  { path: "/wol", label: "Wake-on-LAN", icon: Power },
];

export function Layout({ onLogout }: { onLogout?: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout?.();
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-cockpit-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/ark-icon.jpg"
              alt="Ark"
              className="w-9 h-9 rounded-lg shadow-sm"
            />
            <div>
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
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {modules.map((mod) => (
          <NavLink
            key={mod.path}
            to={mod.path}
            end={mod.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/20"
                  : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5 border border-transparent"
              }`
            }
          >
            <mod.icon className="w-4 h-4 shrink-0" />
            {mod.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-cockpit-border">
        <div className="flex items-center justify-between">
          <div className="text-xs text-cockpit-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-cockpit-success mr-2" />
            All systems nominal
          </div>
        <button
          onClick={handleLogout}
          className="text-cockpit-text-muted hover:text-cockpit-danger transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
        </div>
        <div className="text-[10px] text-cockpit-text-muted/40 mt-1.5">v{__APP_VERSION__}</div>
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
          w-64 bg-cockpit-surface border-r border-cockpit-border
          flex flex-col shrink-0
          transform transition-transform duration-200 ease-in-out
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
