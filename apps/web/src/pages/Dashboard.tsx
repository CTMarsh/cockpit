import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  Anchor,
  Server,
  Bookmark,
  FileText,
  Network,
  Shuffle,
  Activity,
  MonitorDot,
  ScrollText,
  Clock,
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

/** Token alias used for tile accents. Alternates per-module to give the
 *  grid visual rhythm — primary (ocean) vs. warm (golden). */
type Tone = "primary" | "warm";

function toneClasses(tone: Tone) {
  return tone === "warm"
    ? { fg: "text-ark-warm", bg: "bg-ark-warm-bg", border: "hover:border-ark-warm/40" }
    : { fg: "text-ark-primary", bg: "bg-ark-primary-bg", border: "hover:border-ark-primary/40" };
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

  const modules: Array<{
    path: string;
    label: string;
    icon: typeof Server;
    desc: string;
    stat: string;
    tone: Tone;
  }> = [
    { path: "/homelab",    label: "Homelab",         icon: Server,    desc: "Monitor services & containers", stat: stats ? `${stats.serviceCount} services` : "...", tone: "primary" },
    { path: "/bookmarks",  label: "Bookmarks",       icon: Bookmark,  desc: "Save & tag URLs",               stat: stats ? `${stats.bookmarkCount} saved` : "...",   tone: "warm" },
    { path: "/markdown",   label: "Markdown",        icon: FileText,  desc: "Write & collaborate",           stat: stats ? `${stats.docCount} documents` : "...",    tone: "primary" },
    { path: "/graph",      label: "Knowledge Graph", icon: Network,   desc: "Visualize connections",         stat: "Interactive",                                    tone: "warm" },
    { path: "/randomizer", label: "Build Ideas",     icon: Shuffle,   desc: "Random project ideas",          stat: "Generator",                                      tone: "warm" },
    { path: "/proxmox",    label: "Proxmox",         icon: MonitorDot,desc: "VMs & containers on Proxmox",   stat: "Hypervisor",                                     tone: "warm" },
    { path: "/logs",       label: "Log Viewer",      icon: ScrollText,desc: "Container & system logs",       stat: "Streaming",                                      tone: "primary" },
    { path: "/cron",       label: "Cron Jobs",       icon: Clock,     desc: "Scheduled task manager",        stat: "Scheduler",                                      tone: "warm" },
  ];

  const clusterOk    = stats && stats.clusterNodes > 0 && stats.clusterOnline === stats.clusterNodes;
  const clusterDown  = stats && stats.clusterNodes > 0 && stats.clusterOnline < stats.clusterNodes;
  const cronFailing  = stats && stats.cronFailed > 0;

  return (
    <div className="space-y-8 max-w-[1280px]">
      {/* Welcome */}
      <div>
        <h2 className="text-[26px] font-bold tracking-tight text-ark-text-bright flex items-center gap-3">
          <Anchor className="w-6 h-6 text-ark-primary" />
          Welcome to Cockpit
        </h2>
        <p className="text-ark-text-muted mt-1 text-sm">NoahsArk Command Center — weathering every storm</p>
      </div>

      <ErrorBanner message={error} onRetry={loadStats} />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile
            label="Services"
            icon={Server}
            tone="primary"
            value={String(stats.serviceCount)}
            desc="Monitored endpoints"
          />
          <StatTile
            label="Bookmarks"
            icon={Bookmark}
            tone="warm"
            value={String(stats.bookmarkCount)}
            desc={`${stats.docCount} documents`}
          />
          <StatTile
            label="Cluster"
            icon={clusterOk ? CheckCircle2 : clusterDown ? AlertTriangle : Activity}
            tone={clusterOk ? "success" : clusterDown ? "danger" : "muted"}
            value={stats.clusterNodes > 0 ? `${stats.clusterOnline}/${stats.clusterNodes}` : "—"}
            desc={
              stats.clusterNodes === 0
                ? "Not configured"
                : clusterOk
                ? "All nodes online"
                : `${stats.clusterNodes - stats.clusterOnline} offline`
            }
          />
          <StatTile
            label="Cron jobs"
            icon={cronFailing ? AlertTriangle : Clock}
            tone={cronFailing ? "danger" : "primary"}
            value={`${stats.cronEnabled}/${stats.cronTotal}`}
            desc={cronFailing ? `${stats.cronFailed} failed` : "All healthy"}
          />
        </div>
      )}

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {modules.map((mod) => {
          const t = toneClasses(mod.tone);
          return (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className={`group bg-ark-surface border border-ark-border ${t.border} rounded-ark-lg p-[18px] text-left shadow-ark-xs hover:shadow-ark-md transition-all duration-ark ease-ark flex flex-col gap-2.5`}
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-ark ${t.bg} flex items-center justify-center`}>
                  <mod.icon className={`w-5 h-5 ${t.fg}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-ark-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <div className="font-semibold text-ark-text-bright text-sm">{mod.label}</div>
                <div className="text-xs text-ark-text-muted mt-0.5">{mod.desc}</div>
              </div>
              <div className={`text-[11px] ${t.fg} font-semibold`}>{mod.stat}</div>
            </button>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Bookmarks */}
        <div className="bg-ark-surface border border-ark-border rounded-ark-lg p-5 shadow-ark-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ark-text-bright flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-ark-primary" />
              Recent bookmarks
            </h3>
            <button onClick={() => navigate("/bookmarks")} className="text-[11px] text-ark-primary font-medium hover:text-ark-primary-hover">
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
                  className="flex items-center gap-2 text-sm text-ark-text hover:text-ark-primary transition-colors"
                >
                  <ExternalLink className="w-3 h-3 shrink-0 text-ark-text-dim" />
                  <span className="truncate">{b.title || b.url}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ark-text-muted">No bookmarks yet</p>
          )}
        </div>

        {/* Recent Documents */}
        <div className="bg-ark-surface border border-ark-border rounded-ark-lg p-5 shadow-ark-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ark-text-bright flex items-center gap-2">
              <FileText className="w-4 h-4 text-ark-primary" />
              Recent documents
            </h3>
            <button onClick={() => navigate("/markdown")} className="text-[11px] text-ark-primary font-medium hover:text-ark-primary-hover">
              View all
            </button>
          </div>
          {stats?.recentDocs.length ? (
            <div className="space-y-2.5">
              {stats.recentDocs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/markdown/${d.id}`)}
                  className="flex items-center gap-2 text-sm text-ark-text hover:text-ark-primary transition-colors w-full text-left"
                >
                  <FileText className="w-3 h-3 shrink-0 text-ark-text-dim" />
                  <span className="truncate">{d.title}</span>
                  <span className="text-[11px] text-ark-text-muted font-mono ml-auto shrink-0">
                    {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ark-text-muted">No documents yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   StatTile — the instrument-panel tile.
   Uppercase caption label, tinted icon well, display-weight number, semantic
   desc colour. Matches the cockpit-web UI kit spec.
   -------------------------------------------------------------------------- */

function StatTile({
  label,
  icon: Icon,
  tone,
  value,
  desc,
}: {
  label: string;
  icon: typeof Server;
  tone: "primary" | "warm" | "success" | "danger" | "muted";
  value: string;
  desc: string;
}) {
  const palette = {
    primary: { fg: "text-ark-primary", bg: "bg-ark-primary-bg", descFg: "text-ark-text-muted" },
    warm:    { fg: "text-ark-warm",    bg: "bg-ark-warm-bg",    descFg: "text-ark-warm" },
    success: { fg: "text-ark-success", bg: "bg-ark-success-bg", descFg: "text-ark-success" },
    danger:  { fg: "text-ark-danger",  bg: "bg-ark-danger-bg",  descFg: "text-ark-danger" },
    muted:   { fg: "text-ark-text-muted", bg: "bg-ark-surface-2", descFg: "text-ark-text-muted" },
  }[tone];

  return (
    <div className="bg-ark-surface border border-ark-border rounded-ark-lg p-[18px] shadow-ark-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-ark-text-muted uppercase tracking-[0.04em] font-semibold">{label}</span>
        <div className={`w-7 h-7 rounded-ark ${palette.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${palette.fg}`} />
        </div>
      </div>
      <div className="text-[36px] font-light leading-none text-ark-text-bright tabular-nums mt-1.5 mb-1.5">{value}</div>
      <div className={`text-xs ${palette.descFg}`}>{desc}</div>
    </div>
  );
}
