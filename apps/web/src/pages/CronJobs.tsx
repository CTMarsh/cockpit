import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pencil,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface CronRun {
  id: number;
  job_id: string;
  started_at: string;
  finished_at: string;
  exit_code: number;
  output: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  lastRun: CronRun | null;
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every Monday", value: "0 0 * * 1" },
  { label: "Every 1st of month", value: "0 0 1 * *" },
];

export function CronJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CronJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runs, setRuns] = useState<CronRun[]>([]);

  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("0 * * * *");
  const [command, setCommand] = useState("");

  async function fetchJobs() {
    setError("");
    try {
      const d = await api<{ jobs: CronJob[] }>("/cron/jobs");
      setJobs(d.jobs);
    } catch {
      setError("Failed to load cron jobs");
    }
  }

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRuns(jobId: string) {
    try {
      const d = await api<{ runs: CronRun[] }>(`/cron/jobs/${jobId}/runs`);
      setRuns(d.runs);
    } catch {}
  }

  function toggleExpand(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      fetchRuns(jobId);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !schedule || !command) return;

    if (editing) {
      await api(`/cron/jobs/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, schedule, command }),
      });
    } else {
      await api("/cron/jobs", {
        method: "POST",
        body: JSON.stringify({ name, schedule, command }),
      });
    }

    resetForm();
    fetchJobs();
  }

  function resetForm() {
    setName("");
    setSchedule("0 * * * *");
    setCommand("");
    setShowForm(false);
    setEditing(null);
  }

  function startEdit(job: CronJob) {
    setEditing(job);
    setName(job.name);
    setSchedule(job.schedule);
    setCommand(job.command);
    setShowForm(true);
  }

  async function toggleEnabled(job: CronJob) {
    await api(`/cron/jobs/${job.id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: !job.enabled }),
    });
    fetchJobs();
  }

  async function deleteJob(id: string) {
    await api(`/cron/jobs/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    fetchJobs();
  }

  async function runNow(id: string) {
    await api(`/cron/jobs/${id}/run`, { method: "POST" });
    fetchJobs();
    if (expandedJob === id) fetchRuns(id);
  }

  function describeCron(expr: string): string {
    const preset = CRON_PRESETS.find((p) => p.value === expr);
    if (preset) return preset.label;
    const parts = expr.split(" ");
    if (parts.length !== 5) return expr;
    return expr;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Clock className="w-6 h-6 text-cockpit-accent" />
          Cron Job Manager
        </h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      <ErrorBanner message={error} onRetry={fetchJobs} />

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">{editing ? "Edit Job" : "New Cron Job"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Backup Database"
                className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs text-cockpit-text-muted block mb-1">Schedule (cron expression)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="* * * * *"
                  className="flex-1 bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm font-mono"
                  required
                />
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="bg-cockpit-bg border border-cockpit-border rounded-lg px-2 py-2 text-xs"
                >
                  <option value="">Presets...</option>
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-[10px] text-cockpit-text-muted/60 mt-1 font-mono">
                minute hour day month weekday
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-cockpit-text-muted block mb-1">Command</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. curl -sf http://localhost:4000/api/health"
              className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm font-mono"
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium hover:opacity-90">
              {editing ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-cockpit-text-muted hover:text-cockpit-text text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Jobs List */}
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-8 text-center text-cockpit-text-muted">
            No cron jobs yet. Click "New Job" to create one.
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button onClick={() => toggleExpand(job.id)} className="text-cockpit-text-muted hover:text-cockpit-text">
                  {expandedJob === job.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => toggleEnabled(job)}
                  className={job.enabled ? "text-cockpit-success" : "text-cockpit-text-muted"}
                  title={job.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                >
                  {job.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="font-medium">{job.name}</div>
                  <div className="text-xs text-cockpit-text-muted flex gap-3 mt-0.5">
                    <span className="font-mono">{job.schedule}</span>
                    <span>{describeCron(job.schedule)}</span>
                  </div>
                </div>

                {/* Last Run Status */}
                <div className="text-xs text-cockpit-text-muted text-right">
                  {job.lastRun ? (
                    <div className="flex items-center gap-1.5">
                      {job.lastRun.exit_code === 0 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cockpit-success" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-cockpit-danger" />
                      )}
                      <span>{new Date(job.lastRun.started_at).toLocaleString()}</span>
                    </div>
                  ) : (
                    <span>Never run</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button onClick={() => runNow(job.id)} className="p-1.5 rounded hover:bg-cockpit-success/10 text-cockpit-success" aria-label="Run now" title="Run now">
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => startEdit(job)} className="p-1.5 rounded hover:bg-white/5 text-cockpit-text-muted" aria-label="Edit job" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDeleteId(job.id)} className="p-1.5 rounded hover:bg-cockpit-danger/10 text-cockpit-danger" aria-label="Delete job" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Command preview */}
              <div className="px-5 pb-3 -mt-1">
                <code className="text-xs text-cockpit-text-muted/60 font-mono">{job.command}</code>
              </div>

              {/* Expanded: Execution History */}
              {expandedJob === job.id && (
                <div className="border-t border-cockpit-border bg-cockpit-bg/50 px-5 py-3">
                  <div className="text-xs font-medium text-cockpit-text-muted mb-2">Execution History</div>
                  {runs.length === 0 ? (
                    <p className="text-xs text-cockpit-text-muted">No runs yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-auto">
                      {runs.map((run) => (
                        <div key={run.id} className="flex items-start gap-2 text-xs">
                          {run.exit_code === 0 ? (
                            <CheckCircle2 className="w-3 h-3 text-cockpit-success mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="w-3 h-3 text-cockpit-danger mt-0.5 shrink-0" />
                          )}
                          <span className="text-cockpit-text-muted shrink-0">
                            {new Date(run.started_at).toLocaleString()}
                          </span>
                          <span className="text-cockpit-text-muted/60">exit: {run.exit_code}</span>
                          {run.output && (
                            <span className="font-mono text-cockpit-text-muted/50 truncate max-w-xs">
                              {run.output.slice(0, 100)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Cron Job"
        message="This will permanently delete the job and its execution history. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={() => confirmDeleteId && deleteJob(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
