import { NavLink, Outlet } from "react-router-dom";
import {
  Server,
  Bookmark,
  HardDrive,
  Shuffle,
  FileText,
  Network,
  Rocket,
  LogOut,
} from "lucide-react";

const modules = [
  { path: "/homelab", label: "Homelab", icon: Server },
  { path: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { path: "/dedup", label: "Deduplicator", icon: HardDrive },
  { path: "/randomizer", label: "Build Ideas", icon: Shuffle },
  { path: "/markdown", label: "Markdown", icon: FileText },
  { path: "/graph", label: "Knowledge Graph", icon: Network },
];

export function Layout({ onLogout }: { onLogout?: () => void }) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    onLogout?.();
  }
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-cockpit-surface border-r border-cockpit-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-cockpit-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cockpit-accent flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Cockpit</h1>
              <p className="text-xs text-cockpit-text-muted">Command Center</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {modules.map((mod) => (
            <NavLink
              key={mod.path}
              to={mod.path}
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
        <div className="p-4 border-t border-cockpit-border flex items-center justify-between">
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
