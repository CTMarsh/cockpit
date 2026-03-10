import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  GitMerge,
  RefreshCw,
  AlertCircle,
  CircleDot,
  GitPullRequest,
  Play,
  Tag,
  FolderTree,
  Plus,
  MessageSquare,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  RotateCcw,
  Ban,
  ExternalLink,
  Clock,
  Search,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  description: string | null;
  web_url: string;
  last_activity_at: string;
  default_branch: string;
  star_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  state: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  assignee: { name: string; avatar_url: string } | null;
  author: { name: string };
  web_url: string;
  description: string | null;
}

interface GitLabMR {
  id: number;
  iid: number;
  title: string;
  state: string;
  source_branch: string;
  target_branch: string;
  author: { name: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  merge_status: string;
  web_url: string;
  has_conflicts: boolean;
  user_notes_count: number;
}

interface GitLabPipeline {
  id: number;
  status: string;
  ref: string;
  sha: string;
  created_at: string;
  updated_at: string;
  web_url: string;
}

interface GitLabJob {
  id: number;
  name: string;
  stage: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  web_url: string;
}

interface GitLabRelease {
  tag_name: string;
  name: string;
  description: string;
  created_at: string;
  released_at: string;
}

interface GitLabLabel {
  id: number;
  name: string;
  color: string;
  text_color: string;
}

interface GitLabTreeItem {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
}

interface DiffChange {
  oldPath: string;
  newPath: string;
  newFile: boolean;
  renamedFile: boolean;
  deletedFile: boolean;
  diff: string;
}

type Tab = "projects" | "issues" | "mrs" | "pipelines" | "releases" | "repo";

// ─── Helpers ─────────────────────────────────────────────

function relativeTime(dateString: string): string {
  const seconds = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function pipelineStatusColor(status: string): string {
  switch (status) {
    case "success": return "text-cockpit-success";
    case "failed": return "text-cockpit-danger";
    case "running": return "text-blue-400";
    case "pending": return "text-cockpit-warning";
    case "canceled": return "text-cockpit-text-muted";
    case "skipped": return "text-cockpit-text-muted";
    default: return "text-cockpit-text-muted";
  }
}

function pipelineStatusBg(status: string): string {
  switch (status) {
    case "success": return "bg-cockpit-success/10 text-cockpit-success";
    case "failed": return "bg-cockpit-danger/10 text-cockpit-danger";
    case "running": return "bg-blue-500/10 text-blue-400";
    case "pending": return "bg-cockpit-warning/10 text-cockpit-warning";
    case "canceled": return "bg-white/5 text-cockpit-text-muted";
    case "skipped": return "bg-white/5 text-cockpit-text-muted";
    default: return "bg-white/5 text-cockpit-text-muted";
  }
}

function contrastText(bgColor: string): string {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// ─── Main Component ──────────────────────────────────────

export function GitLabPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await api<{ configured: boolean; connected?: boolean; error?: string }>("/gitlab/status");
        if (!status.configured) {
          setConfigured(false);
          setLoading(false);
          return;
        }
        setConfigured(true);
        const res = await api<{ items: GitLabProject[] }>("/gitlab/projects");
        setProjects(res.items);
        if (res.items.length > 0) setSelectedProject(res.items[0].id);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-cockpit-accent animate-spin" />
      </div>
    );
  }

  if (configured === false) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <GitMerge className="w-6 h-6 text-cockpit-accent" />
          GitLab
        </h2>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6">
          <div className="flex items-center gap-3 text-cockpit-warning">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">GitLab Not Configured</span>
          </div>
          <p className="text-sm text-cockpit-text-muted mt-2">
            Add these to your environment variables:
          </p>
          <pre className="mt-3 bg-cockpit-bg rounded-lg p-4 text-sm font-mono text-cockpit-text-muted">
{`GITLAB_URL=https://your-gitlab-instance
GITLAB_TOKEN=your-private-token`}
          </pre>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "projects", label: "Projects", icon: FolderTree },
    { key: "issues", label: "Issues", icon: CircleDot },
    { key: "mrs", label: "Merge Requests", icon: GitPullRequest },
    { key: "pipelines", label: "Pipelines", icon: Play },
    { key: "releases", label: "Releases", icon: Tag },
    { key: "repo", label: "Repository", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <GitMerge className="w-6 h-6 text-cockpit-accent" />
          GitLab
        </h2>
        {/* Project selector */}
        {projects.length > 0 && tab !== "projects" && (
          <select
            value={selectedProject || ""}
            onChange={(e) => setSelectedProject(Number(e.target.value))}
            className="bg-cockpit-surface border border-cockpit-border rounded-lg px-3 py-1.5 text-sm text-cockpit-text focus:outline-none focus:border-cockpit-accent"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg p-3 text-sm text-cockpit-danger">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-cockpit-surface border border-cockpit-border rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-cockpit-accent/15 text-cockpit-accent"
                : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "projects" && (
        <ProjectsTab projects={projects} onSelect={(id) => { setSelectedProject(id); setTab("issues"); }} />
      )}
      {tab === "issues" && selectedProject && <IssuesTab projectId={selectedProject} />}
      {tab === "mrs" && selectedProject && <MRsTab projectId={selectedProject} />}
      {tab === "pipelines" && selectedProject && <PipelinesTab projectId={selectedProject} />}
      {tab === "releases" && selectedProject && <ReleasesTab projectId={selectedProject} />}
      {tab === "repo" && selectedProject && <RepoTab projectId={selectedProject} />}
    </div>
  );
}

// ─── Projects Tab ────────────────────────────────────────

function ProjectsTab({ projects, onSelect }: { projects: GitLabProject[]; onSelect: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 text-left hover:border-cockpit-accent/30 transition-colors"
        >
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-cockpit-text">{p.name}</h3>
            <a
              href={p.web_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-cockpit-text-muted hover:text-cockpit-accent"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          {p.description && (
            <p className="text-sm text-cockpit-text-muted mt-1.5 line-clamp-2">{p.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-cockpit-text-muted">
            <span className="flex items-center gap-1">
              <CircleDot className="w-3 h-3" />
              {p.open_issues_count} issues
            </span>
            <span>{relativeTime(p.last_activity_at)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Issues Tab ──────────────────────────────────────────

function IssuesTab({ projectId }: { projectId: number }) {
  const [issues, setIssues] = useState<GitLabIssue[]>([]);
  const [labels, setLabels] = useState<GitLabLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"opened" | "closed" | "all">("opened");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<GitLabIssue | null>(null);
  const [search, setSearch] = useState("");

  const fetchIssues = useCallback(async () => {
    try {
      const [issueRes, labelRes] = await Promise.all([
        api<{ items: GitLabIssue[] }>(`/gitlab/projects/${projectId}/issues?state=${filter}&per_page=50`),
        api<{ items: GitLabLabel[] }>(`/gitlab/projects/${projectId}/labels?per_page=100`),
      ]);
      setIssues(issueRes.items);
      setLabels(labelRes.items);
    } catch {}
    setLoading(false);
  }, [projectId, filter]);

  useEffect(() => {
    setLoading(true);
    fetchIssues();
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  const filtered = search
    ? issues.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : issues;

  const labelMap = new Map(labels.map((l) => [l.name, l]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {/* Filter */}
        <div className="flex gap-1 bg-cockpit-bg rounded-lg p-0.5">
          {(["opened", "closed", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                filter === f ? "bg-cockpit-surface text-cockpit-accent" : "text-cockpit-text-muted hover:text-cockpit-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cockpit-text-muted" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-cockpit-text placeholder:text-cockpit-text-muted/50 focus:outline-none focus:border-cockpit-accent"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cockpit-accent/10 text-cockpit-accent rounded-lg text-sm font-medium hover:bg-cockpit-accent/20"
        >
          <Plus className="w-3.5 h-3.5" />
          New Issue
        </button>
        <button onClick={fetchIssues} className="text-cockpit-text-muted hover:text-cockpit-accent p-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Issue list */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl divide-y divide-cockpit-border/50">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-cockpit-text-muted text-sm">
            {loading ? "Loading..." : "No issues found"}
          </div>
        ) : (
          filtered.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setSelectedIssue(issue)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3">
                <CircleDot className={`w-4 h-4 mt-0.5 shrink-0 ${
                  issue.state === "opened" ? "text-cockpit-success" : "text-purple-400"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{issue.title}</span>
                    <span className="text-xs text-cockpit-text-muted shrink-0">#{issue.iid}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {issue.labels.map((l) => {
                      const label = labelMap.get(l);
                      return (
                        <span
                          key={l}
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={label ? { backgroundColor: label.color, color: contrastText(label.color) } : {}}
                        >
                          {l}
                        </span>
                      );
                    })}
                    <span className="text-xs text-cockpit-text-muted">{relativeTime(issue.updated_at)}</span>
                    {issue.assignee && (
                      <span className="text-xs text-cockpit-text-muted">→ {issue.assignee.name}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-cockpit-text-muted shrink-0 mt-0.5" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Create issue modal */}
      {showCreate && (
        <CreateIssueModal
          projectId={projectId}
          labels={labels}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchIssues(); }}
        />
      )}

      {/* Issue detail modal */}
      {selectedIssue && (
        <IssueDetailModal
          projectId={projectId}
          issue={selectedIssue}
          labels={labels}
          onClose={() => setSelectedIssue(null)}
          onUpdated={fetchIssues}
        />
      )}
    </div>
  );
}

// ─── Create Issue Modal ──────────────────────────────────

function CreateIssueModal({ projectId, labels, onClose, onCreated }: {
  projectId: number;
  labels: GitLabLabel[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await api(`/gitlab/projects/${projectId}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          labels: selectedLabels.join(",") || undefined,
        }),
      });
      onCreated();
    } catch {}
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cockpit-surface border border-cockpit-border rounded-xl p-6 w-full max-w-lg space-y-4">
        <h3 className="text-lg font-bold">New Issue</h3>
        <input
          type="text"
          placeholder="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm text-cockpit-text placeholder:text-cockpit-text-muted/50 focus:outline-none focus:border-cockpit-accent"
          autoFocus
        />
        <textarea
          placeholder="Description (markdown supported)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm text-cockpit-text placeholder:text-cockpit-text-muted/50 focus:outline-none focus:border-cockpit-accent resize-none"
        />
        {labels.length > 0 && (
          <div>
            <p className="text-xs text-cockpit-text-muted mb-2">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLabels((prev) =>
                    prev.includes(l.name) ? prev.filter((n) => n !== l.name) : [...prev, l.name]
                  )}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium border transition-opacity ${
                    selectedLabels.includes(l.name) ? "opacity-100 border-white/20" : "opacity-40 border-transparent hover:opacity-70"
                  }`}
                  style={{ backgroundColor: l.color, color: contrastText(l.color) }}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-cockpit-text-muted hover:text-cockpit-text">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="px-4 py-1.5 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Issue Detail Modal ──────────────────────────────────

function IssueDetailModal({ projectId, issue, labels, onClose, onUpdated }: {
  projectId: number;
  issue: GitLabIssue;
  labels: GitLabLabel[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: any[] }>(`/gitlab/projects/${projectId}/issues/${issue.iid}/notes`);
        setNotes(res.items.filter((n: any) => !n.system));
      } catch {}
    })();
  }, [projectId, issue.iid]);

  const labelMap = new Map(labels.map((l) => [l.name, l]));

  async function addComment() {
    if (!newNote.trim()) return;
    setSubmitting(true);
    try {
      await api(`/gitlab/projects/${projectId}/issues/${issue.iid}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: newNote.trim() }),
      });
      const res = await api<{ items: any[] }>(`/gitlab/projects/${projectId}/issues/${issue.iid}/notes`);
      setNotes(res.items.filter((n: any) => !n.system));
      setNewNote("");
    } catch {}
    setSubmitting(false);
  }

  async function toggleState() {
    const newState = issue.state === "opened" ? "close" : "reopen";
    try {
      await api(`/gitlab/projects/${projectId}/issues/${issue.iid}`, {
        method: "PUT",
        body: JSON.stringify({ state_event: newState }),
      });
      onUpdated();
      onClose();
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cockpit-surface border border-cockpit-border rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{issue.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                issue.state === "opened" ? "bg-cockpit-success/10 text-cockpit-success" : "bg-purple-500/10 text-purple-400"
              }`}>
                {issue.state}
              </span>
              <span className="text-xs text-cockpit-text-muted">#{issue.iid}</span>
              <span className="text-xs text-cockpit-text-muted">by {issue.author.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-cockpit-text-muted hover:text-cockpit-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.map((l) => {
              const label = labelMap.get(l);
              return (
                <span
                  key={l}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={label ? { backgroundColor: label.color, color: contrastText(label.color) } : {}}
                >
                  {l}
                </span>
              );
            })}
          </div>
        )}

        {/* Description */}
        {issue.description && (
          <div className="bg-cockpit-bg rounded-lg p-4 text-sm text-cockpit-text-muted whitespace-pre-wrap">
            {issue.description}
          </div>
        )}

        {/* Comments */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({notes.length})
          </h4>
          {notes.map((n) => (
            <div key={n.id} className="bg-cockpit-bg rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-cockpit-text">{n.author?.name}</span>
                <span className="text-xs text-cockpit-text-muted">{relativeTime(n.created_at)}</span>
              </div>
              <p className="text-sm text-cockpit-text-muted whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              className="flex-1 bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1.5 text-sm text-cockpit-text placeholder:text-cockpit-text-muted/50 focus:outline-none focus:border-cockpit-accent"
            />
            <button
              onClick={addComment}
              disabled={!newNote.trim() || submitting}
              className="px-3 py-1.5 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-cockpit-border pt-4">
          <a
            href={issue.web_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cockpit-accent hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> View in GitLab
          </a>
          <button
            onClick={toggleState}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              issue.state === "opened"
                ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
                : "bg-cockpit-success/10 text-cockpit-success hover:bg-cockpit-success/20"
            }`}
          >
            {issue.state === "opened" ? "Close Issue" : "Reopen Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MRs Tab ─────────────────────────────────────────────

function MRsTab({ projectId }: { projectId: number }) {
  const [mrs, setMrs] = useState<GitLabMR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"opened" | "merged" | "all">("opened");
  const [selectedMR, setSelectedMR] = useState<GitLabMR | null>(null);

  const fetchMRs = useCallback(async () => {
    try {
      const res = await api<{ items: GitLabMR[] }>(`/gitlab/projects/${projectId}/merge_requests?state=${filter}&per_page=50`);
      setMrs(res.items);
    } catch {}
    setLoading(false);
  }, [projectId, filter]);

  useEffect(() => {
    setLoading(true);
    fetchMRs();
    const interval = setInterval(fetchMRs, 30000);
    return () => clearInterval(interval);
  }, [fetchMRs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-cockpit-bg rounded-lg p-0.5">
          {(["opened", "merged", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
                filter === f ? "bg-cockpit-surface text-cockpit-accent" : "text-cockpit-text-muted hover:text-cockpit-text"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={fetchMRs} className="text-cockpit-text-muted hover:text-cockpit-accent p-1.5 ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl divide-y divide-cockpit-border/50">
        {mrs.length === 0 ? (
          <div className="px-4 py-8 text-center text-cockpit-text-muted text-sm">
            {loading ? "Loading..." : "No merge requests found"}
          </div>
        ) : (
          mrs.map((mr) => (
            <button
              key={mr.id}
              onClick={() => setSelectedMR(mr)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start gap-3">
                <GitPullRequest className={`w-4 h-4 mt-0.5 shrink-0 ${
                  mr.state === "opened" ? "text-cockpit-success" :
                  mr.state === "merged" ? "text-purple-400" : "text-cockpit-text-muted"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{mr.title}</span>
                    <span className="text-xs text-cockpit-text-muted shrink-0">!{mr.iid}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-cockpit-text-muted">
                    <span className="font-mono bg-cockpit-bg px-1.5 py-0.5 rounded">{mr.source_branch}</span>
                    <span>→</span>
                    <span className="font-mono bg-cockpit-bg px-1.5 py-0.5 rounded">{mr.target_branch}</span>
                    <span className="ml-2">{relativeTime(mr.updated_at)}</span>
                    {mr.has_conflicts && <span className="text-cockpit-danger">conflicts</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-cockpit-text-muted shrink-0 mt-0.5" />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedMR && (
        <MRDetailModal
          projectId={projectId}
          mr={selectedMR}
          onClose={() => setSelectedMR(null)}
          onUpdated={fetchMRs}
        />
      )}
    </div>
  );
}

// ─── MR Detail Modal ─────────────────────────────────────

function MRDetailModal({ projectId, mr, onClose, onUpdated }: {
  projectId: number;
  mr: GitLabMR;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [changes, setChanges] = useState<DiffChange[]>([]);
  const [changesCount, setChangesCount] = useState(0);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ changes: DiffChange[]; changesCount: number }>(
          `/gitlab/projects/${projectId}/merge_requests/${mr.iid}/changes`
        );
        setChanges(res.changes);
        setChangesCount(res.changesCount || res.changes.length);
      } catch {}
    })();
  }, [projectId, mr.iid]);

  async function approve() {
    setActionPending(true);
    try {
      await api(`/gitlab/projects/${projectId}/merge_requests/${mr.iid}/approve`, { method: "POST" });
      onUpdated();
    } catch {}
    setActionPending(false);
  }

  async function merge() {
    if (!confirm(`Merge "${mr.title}" into ${mr.target_branch}?`)) return;
    setActionPending(true);
    try {
      await api(`/gitlab/projects/${projectId}/merge_requests/${mr.iid}/merge`, {
        method: "PUT",
        body: JSON.stringify({ should_remove_source_branch: true }),
      });
      onUpdated();
      onClose();
    } catch {}
    setActionPending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-cockpit-surface border border-cockpit-border rounded-xl p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">{mr.title}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-cockpit-text-muted">
              <span className={`px-2 py-0.5 rounded-full ${
                mr.state === "opened" ? "bg-cockpit-success/10 text-cockpit-success" :
                mr.state === "merged" ? "bg-purple-500/10 text-purple-400" : "bg-white/5"
              }`}>
                {mr.state}
              </span>
              <span>!{mr.iid}</span>
              <span>by {mr.author.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-cockpit-text-muted hover:text-cockpit-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch info */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono bg-cockpit-bg px-2 py-1 rounded text-cockpit-accent">{mr.source_branch}</span>
          <span className="text-cockpit-text-muted">→</span>
          <span className="font-mono bg-cockpit-bg px-2 py-1 rounded">{mr.target_branch}</span>
          {mr.has_conflicts && (
            <span className="text-xs bg-cockpit-danger/10 text-cockpit-danger px-2 py-0.5 rounded-full">Has conflicts</span>
          )}
        </div>

        {/* Changed files */}
        <div>
          <h4 className="text-sm font-medium mb-2">Changed files ({changesCount})</h4>
          <div className="bg-cockpit-bg rounded-lg divide-y divide-cockpit-border/50 max-h-60 overflow-y-auto">
            {changes.map((ch, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                {ch.newFile ? (
                  <span className="text-cockpit-success text-xs font-mono">A</span>
                ) : ch.deletedFile ? (
                  <span className="text-cockpit-danger text-xs font-mono">D</span>
                ) : ch.renamedFile ? (
                  <span className="text-cockpit-warning text-xs font-mono">R</span>
                ) : (
                  <span className="text-blue-400 text-xs font-mono">M</span>
                )}
                <span className="font-mono text-xs text-cockpit-text-muted truncate">{ch.newPath}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-cockpit-border pt-4">
          <a
            href={mr.web_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-cockpit-accent hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> View in GitLab
          </a>
          {mr.state === "opened" && (
            <div className="flex gap-2">
              <button
                onClick={approve}
                disabled={actionPending}
                className="px-3 py-1.5 bg-cockpit-success/10 text-cockpit-success rounded-lg text-sm font-medium hover:bg-cockpit-success/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={merge}
                disabled={actionPending || mr.has_conflicts}
                className="px-3 py-1.5 bg-cockpit-accent text-cockpit-bg rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                <GitMerge className="w-3.5 h-3.5" /> Merge
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pipelines Tab ───────────────────────────────────────

function PipelinesTab({ projectId }: { projectId: number }) {
  const [pipelines, setPipelines] = useState<GitLabPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPipeline, setExpandedPipeline] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Record<number, GitLabJob[]>>({});
  const [jobLog, setJobLog] = useState<{ jobId: number; log: string } | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await api<{ items: GitLabPipeline[] }>(`/gitlab/projects/${projectId}/pipelines?per_page=20`);
      setPipelines(res.items);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchPipelines();
    const interval = setInterval(fetchPipelines, 30000);
    return () => clearInterval(interval);
  }, [fetchPipelines]);

  async function loadJobs(pipelineId: number) {
    if (expandedPipeline === pipelineId) {
      setExpandedPipeline(null);
      return;
    }
    setExpandedPipeline(pipelineId);
    if (!jobs[pipelineId]) {
      try {
        const res = await api<{ items: GitLabJob[] }>(`/gitlab/projects/${projectId}/pipelines/${pipelineId}/jobs`);
        setJobs((prev) => ({ ...prev, [pipelineId]: res.items }));
      } catch {}
    }
  }

  async function retryJob(jobId: number) {
    try {
      await api(`/gitlab/projects/${projectId}/jobs/${jobId}/retry`, { method: "POST" });
      fetchPipelines();
    } catch {}
  }

  async function cancelJob(jobId: number) {
    try {
      await api(`/gitlab/projects/${projectId}/jobs/${jobId}/cancel`, { method: "POST" });
      fetchPipelines();
    } catch {}
  }

  async function viewJobLog(jobId: number) {
    try {
      const res = await api<{ log: string }>(`/gitlab/projects/${projectId}/jobs/${jobId}/trace`);
      setJobLog({ jobId, log: res.log });
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={fetchPipelines} className="text-cockpit-text-muted hover:text-cockpit-accent p-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl divide-y divide-cockpit-border/50">
        {pipelines.length === 0 ? (
          <div className="px-4 py-8 text-center text-cockpit-text-muted text-sm">
            {loading ? "Loading..." : "No pipelines found"}
          </div>
        ) : (
          pipelines.map((p) => (
            <div key={p.id}>
              <button
                onClick={() => loadJobs(p.id)}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedPipeline === p.id ? (
                    <ChevronDown className="w-4 h-4 text-cockpit-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-cockpit-text-muted shrink-0" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pipelineStatusBg(p.status)}`}>
                    {p.status}
                  </span>
                  <span className="font-mono text-xs bg-cockpit-bg px-1.5 py-0.5 rounded">{p.ref}</span>
                  <span className="text-xs text-cockpit-text-muted font-mono">{p.sha.slice(0, 8)}</span>
                  <span className="text-xs text-cockpit-text-muted ml-auto">{relativeTime(p.created_at)}</span>
                  <a
                    href={p.web_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-cockpit-text-muted hover:text-cockpit-accent"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </button>

              {/* Expanded jobs */}
              {expandedPipeline === p.id && jobs[p.id] && (
                <div className="px-4 pb-3">
                  <div className="bg-cockpit-bg rounded-lg divide-y divide-cockpit-border/50">
                    {jobs[p.id].map((job) => (
                      <div key={job.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          job.status === "success" ? "bg-cockpit-success" :
                          job.status === "failed" ? "bg-cockpit-danger" :
                          job.status === "running" ? "bg-blue-400 animate-pulse" :
                          job.status === "pending" ? "bg-cockpit-warning" :
                          "bg-cockpit-text-muted"
                        }`} />
                        <span className="text-xs text-cockpit-text-muted w-16 shrink-0">{job.stage}</span>
                        <span className="text-xs font-medium flex-1">{job.name}</span>
                        {job.duration && (
                          <span className="text-xs text-cockpit-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round(job.duration)}s
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewJobLog(job.id)}
                            className="p-1 rounded hover:bg-white/5 text-cockpit-text-muted hover:text-cockpit-text"
                            title="View log"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                          {(job.status === "failed" || job.status === "canceled") && (
                            <button
                              onClick={() => retryJob(job.id)}
                              className="p-1 rounded hover:bg-cockpit-accent/10 text-cockpit-accent"
                              title="Retry"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                          {(job.status === "running" || job.status === "pending") && (
                            <button
                              onClick={() => cancelJob(job.id)}
                              className="p-1 rounded hover:bg-cockpit-danger/10 text-cockpit-danger"
                              title="Cancel"
                            >
                              <Ban className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Job log modal */}
      {jobLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setJobLog(null)} />
          <div className="relative bg-cockpit-surface border border-cockpit-border rounded-xl p-4 w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Job Log #{jobLog.jobId}</h3>
              <button onClick={() => setJobLog(null)} className="text-cockpit-text-muted hover:text-cockpit-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto bg-cockpit-bg rounded-lg p-4 text-xs font-mono text-cockpit-text-muted whitespace-pre-wrap">
              {jobLog.log}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Releases Tab ────────────────────────────────────────

function ReleasesTab({ projectId }: { projectId: number }) {
  const [releases, setReleases] = useState<GitLabRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ items: GitLabRelease[] }>(`/gitlab/projects/${projectId}/releases`);
        setReleases(res.items);
      } catch {}
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="w-5 h-5 text-cockpit-accent animate-spin" />
      </div>
    );
  }

  if (releases.length === 0) {
    return <div className="text-center text-cockpit-text-muted py-8 text-sm">No releases found</div>;
  }

  return (
    <div className="space-y-4">
      {releases.map((r) => (
        <div key={r.tag_name} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <Tag className="w-4 h-4 text-cockpit-accent" />
            <span className="font-mono font-semibold text-cockpit-accent">{r.tag_name}</span>
            {r.name && r.name !== r.tag_name && (
              <span className="text-sm text-cockpit-text">{r.name}</span>
            )}
            <span className="text-xs text-cockpit-text-muted ml-auto">{relativeTime(r.released_at || r.created_at)}</span>
          </div>
          {r.description && (
            <div className="bg-cockpit-bg rounded-lg p-4 text-sm text-cockpit-text-muted whitespace-pre-wrap mt-2">
              {r.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Repository Tab ──────────────────────────────────────

function RepoTab({ projectId }: { projectId: number }) {
  const [tree, setTree] = useState<GitLabTreeItem[]>([]);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const pathParam = path ? `&path=${encodeURIComponent(path)}` : "";
      const res = await api<{ items: GitLabTreeItem[] }>(
        `/gitlab/projects/${projectId}/repository/tree?per_page=100&ref=HEAD${pathParam}`
      );
      // Sort: folders first, then files, alphabetical
      const sorted = res.items.sort((a, b) => {
        if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setTree(sorted);
    } catch {}
    setLoading(false);
  }, [projectId, path]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Breadcrumb segments
  const segments = path ? path.split("/") : [];

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => setPath("")}
          className={`hover:text-cockpit-accent transition-colors ${path ? "text-cockpit-text-muted" : "text-cockpit-text font-medium"}`}
        >
          root
        </button>
        {segments.map((seg, i) => {
          const segPath = segments.slice(0, i + 1).join("/");
          const isLast = i === segments.length - 1;
          return (
            <span key={segPath} className="flex items-center gap-1.5">
              <span className="text-cockpit-text-muted opacity-40">/</span>
              {isLast ? (
                <span className="text-cockpit-text font-medium">{seg}</span>
              ) : (
                <button
                  onClick={() => setPath(segPath)}
                  className="text-cockpit-text-muted hover:text-cockpit-accent"
                >
                  {seg}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 text-cockpit-accent animate-spin" />
        </div>
      ) : (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl divide-y divide-cockpit-border/50">
          {path && (
            <button
              onClick={() => {
                const parent = segments.slice(0, -1).join("/");
                setPath(parent);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.02] text-sm text-cockpit-text-muted"
            >
              ..
            </button>
          )}
          {tree.map((item) => (
            <button
              key={item.path}
              onClick={() => item.type === "tree" ? setPath(item.path) : undefined}
              className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.02] transition-colors flex items-center gap-2.5 text-sm ${
                item.type === "tree" ? "cursor-pointer" : "cursor-default"
              }`}
            >
              {item.type === "tree" ? (
                <Folder className="w-4 h-4 text-cockpit-accent shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-cockpit-text-muted shrink-0" />
              )}
              <span className={item.type === "tree" ? "text-cockpit-text font-medium" : "text-cockpit-text-muted"}>
                {item.name}
              </span>
            </button>
          ))}
          {tree.length === 0 && (
            <div className="px-4 py-8 text-center text-cockpit-text-muted text-sm">Empty directory</div>
          )}
        </div>
      )}
    </div>
  );
}
