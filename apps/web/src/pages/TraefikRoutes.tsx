import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { Route, RefreshCw, Lock, LockOpen, Shield, Globe, Activity, Server } from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

type Tab = "routes" | "middlewares" | "overview";

interface IngressRouteService {
  name: string;
  namespace: string;
  port?: number;
  kind: string;
}

interface IngressRouteMiddleware {
  name: string;
  namespace: string;
}

interface IngressRouteEntry {
  match: string;
  services: IngressRouteService[];
  middlewares: IngressRouteMiddleware[];
}

interface IngressRoute {
  name: string;
  namespace: string;
  entryPoints: string[];
  routes: IngressRouteEntry[];
  tls: { certResolver: string | null; domains: any[]; secretName: string | null } | null;
}

interface Middleware {
  name: string;
  namespace: string;
  type: string;
  config: Record<string, any>;
}

interface Entrypoint {
  name: string;
  address: string;
  protocol: string;
}

interface OverviewProto {
  routers?: number;
  services?: number;
  middlewares?: number;
}

interface Overview {
  http?: OverviewProto;
  tcp?: OverviewProto;
  udp?: OverviewProto;
  features?: Record<string, string>;
}

const MIDDLEWARE_COLORS: Record<string, string> = {
  headers: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  redirectScheme: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  stripPrefix: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  rateLimit: "bg-red-500/15 text-red-400 border-red-500/30",
  basicAuth: "bg-green-500/15 text-green-400 border-green-500/30",
  forwardAuth: "bg-green-500/15 text-green-400 border-green-500/30",
  chain: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  compress: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  ipAllowList: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  retry: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function middlewareColor(type: string): string {
  return MIDDLEWARE_COLORS[type] || "bg-cockpit-accent/15 text-cockpit-accent border-cockpit-accent/30";
}

export function TraefikRoutesPage() {
  const [tab, setTab] = useState<Tab>("routes");
  const [routes, setRoutes] = useState<IngressRoute[]>([]);
  const [middlewares, setMiddlewares] = useState<Middleware[]>([]);
  const [entrypoints, setEntrypoints] = useState<Entrypoint[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewAvailable, setOverviewAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [routeData, mwData, epData, ovData] = await Promise.all([
        api<{ available: boolean; ingressRoutes: IngressRoute[] }>("/traefik/ingressroutes"),
        api<{ available: boolean; middlewares: Middleware[] }>("/traefik/middlewares"),
        api<{ available: boolean; entrypoints: Entrypoint[] }>("/traefik/entrypoints"),
        api<{ available: boolean; overview: Overview | null }>("/traefik/overview"),
      ]);
      setRoutes(routeData.ingressRoutes || []);
      setMiddlewares(mwData.middlewares || []);
      setEntrypoints(epData.entrypoints || []);
      setOverview(ovData.overview);
      setOverviewAvailable(ovData.available);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "routes", label: `Routes (${routes.length})` },
    { key: "middlewares", label: `Middlewares (${middlewares.length})` },
    { key: "overview", label: "Overview" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Route className="w-6 h-6 text-cockpit-accent" /> Traefik Routes
        </h2>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Tabs */}
      <div className="flex gap-1 bg-cockpit-surface border border-cockpit-border rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-cockpit-accent/15 text-cockpit-accent"
                : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Routes tab */}
      {tab === "routes" && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
          {routes.length === 0 && !loading ? (
            <div className="text-center text-cockpit-text-muted py-8">
              No IngressRoutes found. Traefik CRDs may not be accessible.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cockpit-border text-cockpit-text-muted text-left">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Namespace</th>
                    <th className="px-4 py-3 font-medium">Match Rules</th>
                    <th className="px-4 py-3 font-medium">Services</th>
                    <th className="px-4 py-3 font-medium">TLS</th>
                    <th className="px-4 py-3 font-medium">Middlewares</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cockpit-border">
                  {routes.map((route) => (
                    <tr key={`${route.namespace}/${route.name}`} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium">{route.name}</td>
                      <td className="px-4 py-3 text-cockpit-text-muted">{route.namespace}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {route.routes.map((r, i) => (
                            <code
                              key={i}
                              className="inline-block text-xs px-2 py-0.5 bg-cockpit-bg border border-cockpit-border rounded font-mono break-all"
                            >
                              {r.match}
                            </code>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {route.routes.flatMap((r, ri) =>
                            r.services.map((svc, si) => (
                              <span key={`${ri}-${si}`} className="text-xs text-cockpit-text-muted">
                                {svc.name}@{svc.namespace}
                                {svc.port ? `:${svc.port}` : ""}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {route.tls ? (
                          <div className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-cockpit-success" />
                            <span className="text-xs text-cockpit-success">
                              {route.tls.certResolver || route.tls.secretName || "enabled"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <LockOpen className="w-3.5 h-3.5 text-cockpit-text-muted" />
                            <span className="text-xs text-cockpit-text-muted">none</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {route.routes.flatMap((r, ri) =>
                            r.middlewares.map((mw, mi) => (
                              <span
                                key={`${ri}-${mi}`}
                                className="inline-block text-[10px] px-1.5 py-0.5 bg-cockpit-accent/10 text-cockpit-accent border border-cockpit-accent/20 rounded"
                              >
                                {mw.name}
                              </span>
                            ))
                          )}
                          {route.routes.every((r) => r.middlewares.length === 0) && (
                            <span className="text-xs text-cockpit-text-muted">--</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Middlewares tab */}
      {tab === "middlewares" && (
        <div>
          {middlewares.length === 0 && !loading ? (
            <div className="text-center text-cockpit-text-muted py-8">
              No Middlewares found.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {middlewares.map((mw) => (
                <div
                  key={`${mw.namespace}/${mw.name}`}
                  className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-medium">{mw.name}</div>
                      <div className="text-xs text-cockpit-text-muted">{mw.namespace}</div>
                    </div>
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 border rounded-full font-medium whitespace-nowrap ${middlewareColor(mw.type)}`}
                    >
                      {mw.type}
                    </span>
                  </div>
                  {Object.keys(mw.config).length > 0 && (
                    <div className="mt-2 text-[11px] text-cockpit-text-muted bg-cockpit-bg rounded-lg p-2 font-mono overflow-x-auto max-h-24 overflow-y-auto">
                      {Object.entries(mw.config).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-cockpit-accent">{key}</span>:{" "}
                          {typeof val === "object" ? JSON.stringify(val) : String(val)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overview tab */}
      {tab === "overview" && (
        <div>
          {!overviewAvailable ? (
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6 text-center">
              <Activity className="w-8 h-8 text-cockpit-text-muted mx-auto mb-2" />
              <div className="text-cockpit-text-muted">
                Traefik API unavailable. The internal API at port 9000 may not be reachable from the cockpit pod.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["http", "tcp", "udp"] as const).map((proto) => {
                  const stats = overview?.[proto] as OverviewProto | undefined;
                  if (!stats) return null;
                  return (
                    <div
                      key={proto}
                      className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4"
                    >
                      <div className="text-xs text-cockpit-text-muted uppercase tracking-wider mb-3">
                        {proto.toUpperCase()}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-lg font-bold">{stats.routers ?? 0}</div>
                          <div className="text-[10px] text-cockpit-text-muted">Routers</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{stats.services ?? 0}</div>
                          <div className="text-[10px] text-cockpit-text-muted">Services</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{stats.middlewares ?? 0}</div>
                          <div className="text-[10px] text-cockpit-text-muted">Middlewares</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Entrypoints */}
              <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cockpit-accent" /> Entrypoints
                </h3>
                <div className="space-y-2">
                  {entrypoints.map((ep) => (
                    <div
                      key={ep.name}
                      className="flex items-center justify-between bg-cockpit-bg rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-cockpit-text-muted" />
                        <span className="text-sm font-medium">{ep.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-cockpit-text-muted">
                        <span className="font-mono">{ep.address}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ep.protocol === "HTTPS"
                              ? "bg-green-500/15 text-green-400"
                              : "bg-slate-500/15 text-slate-400"
                          }`}
                        >
                          {ep.protocol}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              {overview?.features && Object.keys(overview.features).length > 0 && (
                <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cockpit-accent" /> Features
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(overview.features).map(([key, val]) => (
                      <span
                        key={key}
                        className="text-xs px-2 py-1 bg-cockpit-bg border border-cockpit-border rounded"
                      >
                        {key}: {val}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
