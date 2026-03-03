import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../api";
import {
  ScrollText,
  Search,
  RefreshCw,
  ArrowDown,
  Pause,
  Play,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

interface LogSource {
  id: string;
  name: string;
  state: string;
  type: "container" | "system";
}

export function LogsPage() {
  const [sources, setSources] = useState<LogSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [sourceType, setSourceType] = useState<"container" | "system">("container");
  const [lines, setLines] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState("200");
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ sources: LogSource[] }>("/logs/sources")
      .then((d) => setSources(d.sources))
      .catch(() => setSourceError("Failed to load log sources"));
  }, []);

  async function fetchLogs() {
    if (!selectedSource) return;
    setLoading(true);
    try {
      if (sourceType === "container") {
        const d = await api<{ lines: string[] }>(`/logs/container/${selectedSource}?tail=${tail}`);
        setLines(d.lines);
      } else {
        const d = await api<{ lines: string[] }>(`/logs/system?unit=${selectedSource}&lines=${tail}`);
        setLines(d.lines);
      }
    } catch (e: any) {
      setLines([`Error: ${e.message || "Failed to fetch logs"}`]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (selectedSource) fetchLogs();
  }, [selectedSource, tail]);

  useEffect(() => {
    if (!autoRefresh || !selectedSource) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedSource, tail]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const filteredLines = useMemo(
    () => search ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase())) : lines,
    [lines, search]
  );

  function getSeverityColor(line: string): string {
    const lower = line.toLowerCase();
    if (lower.includes("error") || lower.includes("fatal") || lower.includes("panic")) return "text-red-400";
    if (lower.includes("warn")) return "text-yellow-400";
    if (lower.includes("debug") || lower.includes("trace")) return "text-cockpit-text-muted/60";
    if (lower.includes("info")) return "text-blue-400";
    return "text-cockpit-text-muted";
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <ScrollText className="w-6 h-6 text-cockpit-accent" />
          Log Viewer
        </h2>
      </div>

      <ErrorBanner message={sourceError} onRetry={() => { setSourceError(""); api<{ sources: LogSource[] }>("/logs/sources").then((d) => setSources(d.sources)).catch(() => setSourceError("Failed to load log sources")); }} />

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Source Type */}
        <div className="flex rounded-lg overflow-hidden border border-cockpit-border">
          <button
            onClick={() => { setSourceType("container"); setSelectedSource(""); setLines([]); }}
            className={`px-3 py-1.5 text-xs font-medium ${
              sourceType === "container" ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-text-muted hover:bg-white/5"
            }`}
          >
            Containers
          </button>
          <button
            onClick={() => { setSourceType("system"); setSelectedSource(""); setLines([]); }}
            className={`px-3 py-1.5 text-xs font-medium ${
              sourceType === "system" ? "bg-cockpit-accent/20 text-cockpit-accent" : "text-cockpit-text-muted hover:bg-white/5"
            }`}
          >
            System
          </button>
        </div>

        {/* Source Selector */}
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm min-w-[200px]"
        >
          <option value="">Select source...</option>
          {sourceType === "container" ? (
            sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.state})
              </option>
            ))
          ) : (
            <option value="docker">docker.service</option>
          )}
        </select>

        {/* Tail lines */}
        <select
          value={tail}
          onChange={(e) => setTail(e.target.value)}
          className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="50">50 lines</option>
          <option value="100">100 lines</option>
          <option value="200">200 lines</option>
          <option value="500">500 lines</option>
          <option value="1000">1000 lines</option>
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cockpit-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter logs..."
            className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg pl-9 pr-3 py-1.5 text-sm"
          />
        </div>

        {/* Toggle buttons */}
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            autoRefresh
              ? "border-cockpit-accent/30 bg-cockpit-accent/10 text-cockpit-accent"
              : "border-cockpit-border text-cockpit-text-muted hover:bg-white/5"
          }`}
        >
          {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          Auto
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            autoScroll
              ? "border-cockpit-accent/30 bg-cockpit-accent/10 text-cockpit-accent"
              : "border-cockpit-border text-cockpit-text-muted hover:bg-white/5"
          }`}
        >
          <ArrowDown className="w-3 h-3" />
          Scroll
        </button>
        <button
          onClick={fetchLogs}
          disabled={loading || !selectedSource}
          className="p-1.5 rounded-lg text-cockpit-text-muted hover:text-cockpit-accent border border-cockpit-border hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Count */}
      {selectedSource && (
        <div className="text-xs text-cockpit-text-muted">
          Showing {filteredLines.length} of {lines.length} lines
          {search && ` (filtered by "${search}")`}
        </div>
      )}

      {/* Log Output */}
      <div
        ref={logRef}
        className="flex-1 min-h-[400px] max-h-[calc(100vh-300px)] bg-cockpit-bg border border-cockpit-border rounded-xl overflow-auto font-mono text-xs leading-relaxed"
      >
        {!selectedSource ? (
          <div className="flex items-center justify-center h-full text-cockpit-text-muted text-sm">
            Select a log source to begin
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-cockpit-text-muted text-sm">
            {loading ? "Loading..." : "No logs available"}
          </div>
        ) : (
          <div className="p-3">
            {filteredLines.map((line, i) => (
              <div
                key={i}
                className={`py-0.5 px-2 hover:bg-white/[0.03] rounded ${getSeverityColor(line)}`}
              >
                <span className="text-cockpit-text-muted/30 select-none mr-3 inline-block w-8 text-right">
                  {i + 1}
                </span>
                {search ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: line.replace(
                        new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
                        '<mark class="bg-cockpit-accent/30 text-cockpit-accent rounded px-0.5">$1</mark>'
                      ),
                    }}
                  />
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
