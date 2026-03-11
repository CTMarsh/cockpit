import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import {
  Terminal as TerminalIcon,
  RefreshCw,
  Play,
  PlayCircle,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface AnsibleRun {
  id: string;
  playbook: string;
  tags: string;
  extra_vars: string;
  dry_run: number;
  status: string;
  output: string;
  exit_code: number | null;
  started_at: string;
  completed_at: string | null;
}

function Terminal({ output, status }: { output: string; status: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [output]);

  return (
    <div className="bg-black/90 border border-cockpit-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-cockpit-surface/50 border-b border-cockpit-border">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "running"
              ? "bg-yellow-400 animate-pulse"
              : status === "success"
                ? "bg-green-400"
                : status === "failed"
                  ? "bg-red-400"
                  : "bg-gray-400"
          }`}
        />
        <span className="text-xs text-cockpit-text-muted font-mono">ansible-playbook</span>
      </div>
      <pre
        ref={ref}
        className="p-4 text-xs text-green-400 font-mono overflow-auto max-h-[500px] whitespace-pre-wrap"
      >
        {output || "Waiting for output..."}
      </pre>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Running
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">
        <CheckCircle2 className="w-3 h-3" /> Success
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-400/10 text-gray-400">
      <Clock className="w-3 h-3" /> {status}
    </span>
  );
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "...";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

export function AnsibleRunnerPage() {
  const [playbooks, setPlaybooks] = useState<string[]>([]);
  const [runs, setRuns] = useState<AnsibleRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toast = useToast();

  // Form state
  const [selectedPlaybook, setSelectedPlaybook] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [extraVarsInput, setExtraVarsInput] = useState("{}");
  const [extraVarsError, setExtraVarsError] = useState("");

  // Active run viewing
  const [activeRun, setActiveRun] = useState<AnsibleRun | null>(null);
  const [streamOutput, setStreamOutput] = useState("");
  const [streamStatus, setStreamStatus] = useState("pending");
  const eventSourceRef = useRef<{ close: () => void } | null>(null);

  // Confirm dialog
  const [confirmRun, setConfirmRun] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnsibleRun | null>(null);

  // Track if a dry run succeeded recently (client-side hint)
  const [hasDryRunSuccess, setHasDryRunSuccess] = useState(false);

  const fetchPlaybooks = useCallback(async () => {
    try {
      const data = await api<{ playbooks: string[] }>("/ansible/playbooks");
      setPlaybooks(data.playbooks);
      if (data.playbooks.length > 0 && !selectedPlaybook) {
        setSelectedPlaybook(data.playbooks[0]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [selectedPlaybook]);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await api<{ runs: AnsibleRun[] }>("/ansible/runs?limit=20");
      setRuns(data.runs);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPlaybooks(), fetchRuns()]).finally(() => setLoading(false));
  }, [fetchPlaybooks, fetchRuns]);

  // Check dry run status when form params change
  useEffect(() => {
    const matching = runs.find(
      (r) =>
        r.playbook === selectedPlaybook &&
        r.tags === tagsInput &&
        r.extra_vars === (extraVarsInput || "{}") &&
        r.dry_run === 1 &&
        r.status === "success" &&
        new Date(r.started_at).getTime() > Date.now() - 3600000
    );
    setHasDryRunSuccess(!!matching);
  }, [runs, selectedPlaybook, tagsInput, extraVarsInput]);

  function validateExtraVars(val: string): boolean {
    if (!val || val.trim() === "" || val.trim() === "{}") {
      setExtraVarsError("");
      return true;
    }
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        setExtraVarsError("Must be a JSON object");
        return false;
      }
      setExtraVarsError("");
      return true;
    } catch {
      setExtraVarsError("Invalid JSON");
      return false;
    }
  }

  function connectSSE(runId: string) {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStreamOutput("");
    setStreamStatus("running");

    const evtSource = new EventSource(`/api/ansible/runs/${runId}/stream`);
    eventSourceRef.current = evtSource;

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.output) {
          setStreamOutput((prev) => prev + data.output);
        }
        if (data.done) {
          setStreamStatus(data.status || "success");
          evtSource.close();
          eventSourceRef.current = null;
          fetchRuns();
        }
      } catch {
        /* ignore parse errors */
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
      eventSourceRef.current = null;
      setStreamStatus("failed");
    };
  }

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  async function executeDryRun() {
    if (!validateExtraVars(extraVarsInput)) return;

    try {
      let parsedVars = {};
      if (extraVarsInput && extraVarsInput.trim() !== "" && extraVarsInput.trim() !== "{}") {
        parsedVars = JSON.parse(extraVarsInput);
      }

      const data = await api<{ id: string }>("/ansible/run", {
        method: "POST",
        body: JSON.stringify({
          playbook: selectedPlaybook,
          tags: tagsInput || undefined,
          extra_vars: parsedVars,
          dry_run: true,
        }),
      });

      toast.success("Dry run started");
      setActiveRun({ id: data.id, playbook: selectedPlaybook, tags: tagsInput, extra_vars: extraVarsInput, dry_run: 1, status: "running", output: "", exit_code: null, started_at: new Date().toISOString(), completed_at: null });
      connectSSE(data.id);
      fetchRuns();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function executeRealRun() {
    setConfirmRun(false);
    if (!validateExtraVars(extraVarsInput)) return;

    try {
      let parsedVars = {};
      if (extraVarsInput && extraVarsInput.trim() !== "" && extraVarsInput.trim() !== "{}") {
        parsedVars = JSON.parse(extraVarsInput);
      }

      const data = await api<{ id: string }>("/ansible/run", {
        method: "POST",
        body: JSON.stringify({
          playbook: selectedPlaybook,
          tags: tagsInput || undefined,
          extra_vars: parsedVars,
          dry_run: false,
        }),
      });

      toast.success("Playbook execution started");
      setActiveRun({ id: data.id, playbook: selectedPlaybook, tags: tagsInput, extra_vars: extraVarsInput, dry_run: 0, status: "running", output: "", exit_code: null, started_at: new Date().toISOString(), completed_at: null });
      connectSSE(data.id);
      fetchRuns();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function viewRun(run: AnsibleRun) {
    try {
      const data = await api<{ run: AnsibleRun }>(`/ansible/runs/${run.id}`);
      setActiveRun(data.run);
      setStreamOutput(data.run.output);
      setStreamStatus(data.run.status);
      if (data.run.status === "running") {
        connectSSE(data.run.id);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteRun() {
    if (!deleteTarget) return;
    try {
      await api(`/ansible/runs/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Run deleted");
      setDeleteTarget(null);
      if (activeRun?.id === deleteTarget.id) {
        setActiveRun(null);
        setStreamOutput("");
        setStreamStatus("pending");
      }
      fetchRuns();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const isRunning = runs.some((r) => r.status === "running");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <TerminalIcon className="w-6 h-6 text-cockpit-accent" /> Ansible Runner
        </h2>
        <button
          onClick={() => {
            fetchPlaybooks();
            fetchRuns();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel: Controls + History */}
        <div className="space-y-4">
          {/* Playbook controls */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-cockpit-text-muted uppercase tracking-wide">Execute Playbook</h3>

            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Playbook</label>
              <select
                value={selectedPlaybook}
                onChange={(e) => setSelectedPlaybook(e.target.value)}
                className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
              >
                {playbooks.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Tags (optional, comma-separated)</label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g., upgrade,restart"
                className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
              />
            </div>

            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Extra Variables (JSON, optional)</label>
              <textarea
                value={extraVarsInput}
                onChange={(e) => {
                  setExtraVarsInput(e.target.value);
                  validateExtraVars(e.target.value);
                }}
                rows={3}
                placeholder='{"key": "value"}'
                className={`w-full px-3 py-2 bg-cockpit-bg border rounded-lg text-sm font-mono focus:outline-none ${
                  extraVarsError ? "border-cockpit-danger" : "border-cockpit-border focus:border-cockpit-accent"
                }`}
              />
              {extraVarsError && (
                <p className="text-xs text-cockpit-danger mt-1">{extraVarsError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={executeDryRun}
                disabled={isRunning || !selectedPlaybook}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayCircle className="w-4 h-4" /> Dry Run
              </button>
              <div className="relative flex-1 group">
                <button
                  onClick={() => setConfirmRun(true)}
                  disabled={isRunning || !selectedPlaybook || !hasDryRunSuccess}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-cockpit-accent text-cockpit-bg rounded-lg hover:opacity-90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" /> Run
                </button>
                {!hasDryRunSuccess && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-cockpit-bg border border-cockpit-border rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Dry run required first
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Run history */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-cockpit-text-muted uppercase tracking-wide">Run History</h3>
            {runs.length === 0 && !loading && (
              <div className="text-center text-cockpit-text-muted text-sm py-4">No runs yet.</div>
            )}
            {runs.map((run) => (
              <div
                key={run.id}
                onClick={() => viewRun(run)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5 ${
                  activeRun?.id === run.id ? "bg-white/5 border border-cockpit-accent/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {run.playbook}
                    {run.dry_run ? " (dry)" : ""}
                  </div>
                  <div className="text-[10px] text-cockpit-text-muted flex items-center gap-2">
                    <span>{new Date(run.started_at).toLocaleString()}</span>
                    <span>{formatDuration(run.started_at, run.completed_at)}</span>
                  </div>
                </div>
                <StatusBadge status={run.status} />
                {run.status !== "running" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(run);
                    }}
                    className="p-1 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Terminal output */}
        <div className="lg:col-span-2 space-y-2">
          {activeRun && (
            <div className="flex items-center justify-between text-sm text-cockpit-text-muted mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono">{activeRun.playbook}</span>
                {activeRun.tags && <span className="text-xs bg-cockpit-bg px-1.5 py-0.5 rounded">{activeRun.tags}</span>}
                {activeRun.dry_run ? <span className="text-xs bg-yellow-400/10 text-yellow-400 px-1.5 py-0.5 rounded">DRY RUN</span> : null}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={streamStatus} />
                {streamStatus !== "running" && activeRun.exit_code !== null && activeRun.exit_code !== undefined && (
                  <span className="text-xs">exit: {activeRun.exit_code}</span>
                )}
                {activeRun.completed_at && (
                  <span className="text-xs">{formatDuration(activeRun.started_at, activeRun.completed_at)}</span>
                )}
              </div>
            </div>
          )}
          <Terminal output={streamOutput} status={streamStatus} />
        </div>
      </div>

      {/* Confirm real run dialog */}
      {confirmRun && (
        <ConfirmDialog
          open={true}
          title="Execute Playbook"
          message={`This will execute ${selectedPlaybook} on the cluster. Continue?`}
          confirmLabel="Execute"
          onConfirm={executeRealRun}
          onCancel={() => setConfirmRun(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Run"
          message={`Delete this ${deleteTarget.playbook} run from ${new Date(deleteTarget.started_at).toLocaleString()}?`}
          confirmLabel="Delete"
          danger
          onConfirm={deleteRun}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
