import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Anchor,
  Server,
  Bookmark,
  FileText,
  Network,
  HardDrive,
  Shuffle,
  Activity,
  MonitorDot,
  ScrollText,
  Clock,
  Power,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

interface DashStats {
  bookmarkCount: number;
  docCount: number;
  serviceCount: number;
  cronTotal: number;
  cronEnabled: number;
  cronFailed: number;
  clusterNodes: number;
  clusterOnline: number;
  recentBookmarks: { id: string; title: string; url: string; created_at: string }[];
  recentDocs: { id: string; title: string; updated_at: string }[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashStats | null>(null);
  const [error, setError] = useState("");

  function loadStats() {
    setError("");
    api<DashStats>("/dashboard/stats")
      .then(setStats)
      .catch(() => setError("Failed to load dashboard stats"));
  }

  useEffect(() => { loadStats(); }, []);

  const modules = [
    { path: "/homelab", label: "Homelab", icon: Server, desc: "Monitor services & containers", stat: stats ? `${stats.serviceCount} services` : "..." },
    { path: "/bookmarks", label: "Bookmarks", icon: Bookmark, desc: "Save & tag URLs", stat: stats ? `${stats.bookmarkCount} saved` : "..." },
    { path: "/markdown", label: "Markdown", icon: FileText, desc: "Write & collaborate", stat: stats ? `${stats.docCount} documents` : "..." },
    { path: "/graph", label: "Knowledge Graph", icon: Network, desc: "Visualize connections", stat: "Interactive" },
    { path: "/dedup", label: "Deduplicator", icon: HardDrive, desc: "Find duplicate files", stat: "Scanner" },
    { path: "/randomizer", label: "Build Ideas", icon: Shuffle, desc: "Random project ideas", stat: "Generator" },
    { path: "/monitor", label: "Cluster Monitor", icon: Activity, desc: "Node & pod metrics", stat: "Real-time" },
    { path: "/proxmox", label: "Proxmox", icon: MonitorDot, desc: "VMs & containers on Proxmox", stat: "Hypervisor" },
    { path: "/logs", label: "Log Viewer", icon: ScrollText, desc: "Container & system logs", stat: "Streaming" },
    { path: "/cron", label: "Cron Jobs", icon: Clock, desc: "Scheduled task manager", stat: "Scheduler" },
    { path: "/wol", label: "Wake-on-LAN", icon: Power, desc: "Wake machines remotely", stat: "Network" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Anchor className="w-6 h-6 text-cockpit-accent" />
          Welcome to Cockpit
        </h2>
        <p className="text-cockpit-text-muted mt-1">NoahsArk Command Center — weathering every storm</p>
      </div>

      <ErrorBanner message={error} onRetry={loadStats} />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cockpit-text-muted">Services</span>
              <Server className="w-4 h-4 text-cockpit-accent" />
            </div>
            <div className="text-2xl font-bold mt-1">{stats.serviceCount}</div>
            <div className="text-xs text-cockpit-text-muted mt-1">Monitored endpoints</div>
          </div>
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cockpit-text-muted">Bookmarks</span>
              <Bookmark className="w-4 h-4 text-cockpit-accent" />
            </div>
            <div className="text-2xl font-bold mt-1">{stats.bookmarkCount}</div>
            <div className="text-xs text-cockpit-text-muted mt-1">{stats.docCount} documents</div>
          </div>
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cockpit-text-muted">Cluster</span>
              {stats.clusterNodes > 0 ? (
                stats.clusterOnline === stats.clusterNodes
                  ? <CheckCircle2 className="w-4 h-4 text-cockpit-success" />
                  : <AlertTriangle className="w-4 h-4 text-cockpit-danger" />
              ) : (
                <Activity className="w-4 h-4 text-cockpit-text-muted" />
              )}
            </div>
            <div className="text-2xl font-bold mt-1">
              {stats.clusterNodes > 0 ? `${stats.clusterOnline}/${stats.clusterNodes}` : "—"}
            </div>
            <div className="text-xs mt-1">
              {stats.clusterNodes > 0 ? (
                <span className={stats.clusterOnline === stats.clusterNodes ? "text-cockpit-success" : "text-cockpit-danger"}>
                  {stats.clusterOnline === stats.clusterNodes ? "All nodes online" : `${stats.clusterNodes - stats.clusterOnline} offline`}
                </span>
              ) : (
                <span className="text-cockpit-text-muted">Not configured</span>
              )}
            </div>
          </div>
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-cockpit-text-muted">Cron Jobs</span>
              {stats.cronFailed > 0
                ? <AlertTriangle className="w-4 h-4 text-cockpit-danger" />
                : <Clock className="w-4 h-4 text-cockpit-accent" />
              }
            </div>
            <div className="text-2xl font-bold mt-1">{stats.cronEnabled}/{stats.cronTotal}</div>
            <div className="text-xs mt-1">
              {stats.cronFailed > 0 ? (
                <span className="text-cockpit-danger">{stats.cronFailed} failed</span>
              ) : (
                <span className="text-cockpit-text-muted">All healthy</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <button
            key={mod.path}
            onClick={() => navigate(mod.path)}
            className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 text-left hover:border-cockpit-accent/40 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-cockpit-accent/10 flex items-center justify-center">
                <mod.icon className="w-5 h-5 text-cockpit-accent" />
              </div>
              <ArrowRight className="w-4 h-4 text-cockpit-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-3">
              <div className="font-semibold">{mod.label}</div>
              <div className="text-sm text-cockpit-text-muted mt-0.5">{mod.desc}</div>
            </div>
            <div className="text-xs text-cockpit-accent mt-3 font-medium">{mod.stat}</div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookmarks */}
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-cockpit-accent" />
              Recent Bookmarks
            </h3>
            <button onClick={() => navigate("/bookmarks")} className="text-xs text-cockpit-accent hover:underline">
              View all
            </button>
          </div>
          {stats?.recentBookmarks.length ? (
            <div className="space-y-2.5">
              {stats.recentBookmarks.map((b) => (
                <a
                  key={b.id}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm hover:text-cockpit-accent transition-colors"
                >
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                  <span className="truncate">{b.title || b.url}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cockpit-text-muted">No bookmarks yet</p>
          )}
        </div>

        {/* Recent Documents */}
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-cockpit-accent" />
              Recent Documents
            </h3>
            <button onClick={() => navigate("/markdown")} className="text-xs text-cockpit-accent hover:underline">
              View all
            </button>
          </div>
          {stats?.recentDocs.length ? (
            <div className="space-y-2.5">
              {stats.recentDocs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/markdown/${d.id}`)}
                  className="flex items-center gap-2 text-sm hover:text-cockpit-accent transition-colors w-full text-left"
                >
                  <FileText className="w-3 h-3 shrink-0 opacity-40" />
                  <span className="truncate">{d.title}</span>
                  <span className="text-xs text-cockpit-text-muted ml-auto shrink-0">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-cockpit-text-muted">No documents yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
