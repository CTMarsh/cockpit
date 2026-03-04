import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api";
import {
  Home,
  RefreshCw,
  Lightbulb,
  ToggleLeft,
  Thermometer,
  Droplets,
  Zap,
  Eye,
  Lock,
  Search,
  ChevronDown,
  Activity,
  Circle,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { useToast } from "../components/Toast";

type Tab = "overview" | "entities" | "controls";

interface HAEntity {
  entity_id: string;
  state: string;
  domain: string;
  friendly_name: string;
  icon: string | null;
  unit: string | null;
  device_class: string | null;
  last_changed: string;
  last_updated: string;
  attributes: Record<string, any>;
}

const DOMAIN_ICONS: Record<string, any> = {
  light: Lightbulb,
  switch: ToggleLeft,
  climate: Thermometer,
  sensor: Activity,
  binary_sensor: Eye,
  lock: Lock,
  automation: Zap,
  input_boolean: ToggleLeft,
  humidifier: Droplets,
};

const DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  sensor: "Sensors",
  binary_sensor: "Binary Sensors",
  climate: "Climate",
  automation: "Automations",
  input_boolean: "Input Booleans",
  lock: "Locks",
  cover: "Covers",
  fan: "Fans",
  media_player: "Media Players",
  camera: "Cameras",
  person: "People",
  zone: "Zones",
  script: "Scripts",
  scene: "Scenes",
  humidifier: "Humidifiers",
};

function stateColor(domain: string, state: string): string {
  if (state === "unavailable" || state === "unknown") return "text-cockpit-text-muted";
  if (domain === "light" || domain === "switch" || domain === "input_boolean" || domain === "fan") {
    return state === "on" ? "text-cockpit-accent" : "text-cockpit-text-muted";
  }
  if (domain === "binary_sensor") {
    return state === "on" ? "text-cockpit-warning" : "text-cockpit-success";
  }
  if (domain === "lock") {
    return state === "locked" ? "text-cockpit-success" : "text-cockpit-danger";
  }
  if (domain === "climate") {
    if (state === "heating") return "text-orange-400";
    if (state === "cooling") return "text-blue-400";
    return "text-cockpit-text-muted";
  }
  return "text-cockpit-text";
}

function isToggleable(domain: string): boolean {
  return ["light", "switch", "input_boolean", "automation", "fan", "cover"].includes(domain);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function HomeAssistantPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [entities, setEntities] = useState<HAEntity[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const sseRef = useRef<EventSource | null>(null);
  const toast = useToast();

  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ available: boolean; entities: HAEntity[]; message?: string }>("/ha/states");
      setAvailable(data.available);
      if (data.available) {
        setEntities(data.entities);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  // SSE for real-time updates
  useEffect(() => {
    if (!available) return;
    const es = new EventSource(`/api/ha/events/stream`);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "state_changed" && data.new_state) {
          setEntities((prev) =>
            prev.map((e) =>
              e.entity_id === data.entity_id
                ? {
                    ...e,
                    state: data.new_state.state,
                    friendly_name: data.new_state.friendly_name || e.friendly_name,
                    last_changed: data.new_state.last_changed || e.last_changed,
                    attributes: data.new_state.attributes || e.attributes,
                  }
                : e
            )
          );
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [available]);

  async function toggleEntity(entityId: string) {
    const domain = entityId.split(".")[0];
    setToggling((prev) => new Set(prev).add(entityId));
    try {
      await api(`/ha/services/homeassistant/toggle`, {
        method: "POST",
        body: JSON.stringify({ entity_id: entityId }),
      });
      // Optimistic update
      setEntities((prev) =>
        prev.map((e) =>
          e.entity_id === entityId ? { ...e, state: e.state === "on" ? "off" : "on" } : e
        )
      );
      toast.success(`Toggled ${entityId}`);
    } catch (e: any) {
      toast.error(`Failed to toggle: ${e.message}`);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(entityId);
        return next;
      });
    }
  }

  // Group entities by domain
  const domains = [...new Set(entities.map((e) => e.domain))].sort();
  const filtered = entities.filter((e) => {
    if (domainFilter && e.domain !== domainFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.friendly_name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q);
    }
    return true;
  });
  const grouped = domains.reduce<Record<string, HAEntity[]>>((acc, d) => {
    const items = filtered.filter((e) => e.domain === d);
    if (items.length > 0) acc[d] = items;
    return acc;
  }, {});

  // Overview stats
  const domainCounts = domains.reduce<Record<string, number>>((acc, d) => {
    acc[d] = entities.filter((e) => e.domain === d).length;
    return acc;
  }, {});
  const onCount = entities.filter((e) => e.state === "on").length;
  const unavailCount = entities.filter((e) => e.state === "unavailable").length;

  if (!available && !loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Home className="w-6 h-6 text-cockpit-accent" /> Home Assistant
        </h2>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-8 text-center">
          <Home className="w-12 h-12 text-cockpit-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Home Assistant Not Configured</h3>
          <p className="text-cockpit-text-muted text-sm max-w-md mx-auto">
            Set <code className="px-1.5 py-0.5 bg-cockpit-bg rounded text-xs">HA_URL</code> and{" "}
            <code className="px-1.5 py-0.5 bg-cockpit-bg rounded text-xs">HA_TOKEN</code> environment
            variables to connect to your Home Assistant instance.
          </p>
          <p className="text-cockpit-text-muted text-xs mt-4">
            Example: <code className="text-cockpit-accent">HA_URL=http://homeassistant.local:8123</code>
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "entities", label: `Entities (${entities.length})` },
    { key: "controls", label: "Controls" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Home className="w-6 h-6 text-cockpit-accent" /> Home Assistant
        </h2>
        <button
          onClick={fetchEntities}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
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

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="text-2xl font-bold">{entities.length}</div>
              <div className="text-xs text-cockpit-text-muted">Total Entities</div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="text-2xl font-bold text-cockpit-accent">{onCount}</div>
              <div className="text-xs text-cockpit-text-muted">Currently On</div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className="text-2xl font-bold">{domains.length}</div>
              <div className="text-xs text-cockpit-text-muted">Domains</div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
              <div className={`text-2xl font-bold ${unavailCount > 0 ? "text-cockpit-danger" : "text-cockpit-success"}`}>
                {unavailCount}
              </div>
              <div className="text-xs text-cockpit-text-muted">Unavailable</div>
            </div>
          </div>

          {/* Domain breakdown */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Entities by Domain</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(domainCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([domain, count]) => {
                  const Icon = DOMAIN_ICONS[domain] || Circle;
                  return (
                    <button
                      key={domain}
                      onClick={() => { setDomainFilter(domain); setTab("entities"); }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cockpit-bg hover:bg-white/5 text-sm transition-colors"
                    >
                      <Icon className="w-4 h-4 text-cockpit-accent shrink-0" />
                      <span className="truncate">{DOMAIN_LABELS[domain] || domain}</span>
                      <span className="ml-auto text-cockpit-text-muted text-xs">{count}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Entities tab */}
      {tab === "entities" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
              <input
                type="text"
                placeholder="Search entities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-cockpit-surface border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
              />
            </div>
            <div className="relative">
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-cockpit-surface border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
              >
                <option value="">All Domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>{DOMAIN_LABELS[d] || d}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Grouped entity list */}
          {Object.entries(grouped).map(([domain, items]) => {
            const Icon = DOMAIN_ICONS[domain] || Circle;
            return (
              <div key={domain} className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-cockpit-bg/50 border-b border-cockpit-border flex items-center gap-2">
                  <Icon className="w-4 h-4 text-cockpit-accent" />
                  <span className="text-sm font-semibold">{DOMAIN_LABELS[domain] || domain}</span>
                  <span className="text-xs text-cockpit-text-muted">({items.length})</span>
                </div>
                <div className="divide-y divide-cockpit-border">
                  {items.map((e) => (
                    <div key={e.entity_id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{e.friendly_name}</div>
                        <div className="text-xs text-cockpit-text-muted truncate">{e.entity_id}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-medium ${stateColor(e.domain, e.state)}`}>
                          {e.state}{e.unit ? ` ${e.unit}` : ""}
                        </div>
                        <div className="text-[10px] text-cockpit-text-muted">{timeAgo(e.last_changed)}</div>
                      </div>
                      {isToggleable(e.domain) && (
                        <button
                          onClick={() => toggleEntity(e.entity_id)}
                          disabled={toggling.has(e.entity_id)}
                          className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                            e.state === "on"
                              ? "bg-cockpit-accent/15 border-cockpit-accent/30 text-cockpit-accent hover:bg-cockpit-accent/25"
                              : "bg-cockpit-bg border-cockpit-border text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
                          } disabled:opacity-50`}
                        >
                          {toggling.has(e.entity_id) ? "..." : e.state === "on" ? "ON" : "OFF"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Object.keys(grouped).length === 0 && !loading && (
            <div className="text-center text-cockpit-text-muted py-8">No entities match your filter.</div>
          )}
        </div>
      )}

      {/* Controls tab */}
      {tab === "controls" && (
        <div className="space-y-4">
          <p className="text-sm text-cockpit-text-muted">Quick controls for toggleable entities.</p>
          {/* Lights */}
          {(() => {
            const lights = entities.filter((e) => e.domain === "light");
            const switches = entities.filter((e) => e.domain === "switch");
            const automations = entities.filter((e) => e.domain === "automation");
            const sections = [
              { label: "Lights", icon: Lightbulb, items: lights },
              { label: "Switches", icon: ToggleLeft, items: switches },
              { label: "Automations", icon: Zap, items: automations },
            ].filter((s) => s.items.length > 0);

            return sections.map((section) => (
              <div key={section.label} className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-cockpit-bg/50 border-b border-cockpit-border flex items-center gap-2">
                  <section.icon className="w-4 h-4 text-cockpit-accent" />
                  <span className="text-sm font-semibold">{section.label}</span>
                  <span className="text-xs text-cockpit-text-muted">({section.items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-3">
                  {section.items.map((e) => (
                    <button
                      key={e.entity_id}
                      onClick={() => toggleEntity(e.entity_id)}
                      disabled={toggling.has(e.entity_id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                        e.state === "on"
                          ? "bg-cockpit-accent/10 border-cockpit-accent/30 hover:bg-cockpit-accent/20"
                          : "bg-cockpit-bg border-cockpit-border hover:bg-white/5"
                      } disabled:opacity-50`}
                    >
                      <section.icon
                        className={`w-5 h-5 shrink-0 ${e.state === "on" ? "text-cockpit-accent" : "text-cockpit-text-muted"}`}
                      />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">{e.friendly_name}</div>
                        <div className={`text-xs ${e.state === "on" ? "text-cockpit-accent" : "text-cockpit-text-muted"}`}>
                          {e.state === "on" ? "On" : "Off"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ));
          })()}
          {entities.filter((e) => isToggleable(e.domain)).length === 0 && !loading && (
            <div className="text-center text-cockpit-text-muted py-8">No controllable entities found.</div>
          )}
        </div>
      )}
    </div>
  );
}
