import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  Bell,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Key,
  Smartphone,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ExternalLink,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageHeader } from "../components/PageHeader";
import { useToast } from "../components/Toast";

type Tab = "projects" | "devices" | "notifications" | "health";

interface Project {
  id: number;
  name: string;
  slug: string;
  api_key: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface Device {
  id: number;
  device_token: string;
  platform: string;
  project_id: number;
  label: string;
  active: number;
  created_at: string;
  updated_at: string;
}

interface Notification {
  id: number;
  project_id: number;
  title: string;
  body: string;
  data: string;
  priority: string;
  created_at: string;
  project_name?: string;
}

interface Delivery {
  id: number;
  notification_id: number;
  device_id: number;
  status: string;
  apns_id: string | null;
  error: string | null;
  sent_at: string;
}

interface HealthData {
  reachable: boolean;
  status?: string;
  version?: string;
  uptime?: number;
  apns_configured?: boolean;
  projects_count?: number;
  devices_count?: number;
  error?: string;
}

export function NotifyPage() {
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifTotal, setNotifTotal] = useState(0);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [regenTarget, setRegenTarget] = useState<Project | null>(null);
  const [selectedNotif, setSelectedNotif] = useState<(Notification & { deliveries?: Delivery[] }) | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [deviceFilter, setDeviceFilter] = useState<number | "all">("all");
  const [notifPage, setNotifPage] = useState(0);
  const toast = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api<HealthData>("/notify/health");
      setHealth(data);
    } catch {
      setHealth({ reachable: false, error: "Cannot reach Cockpit API" });
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api<{ projects: Project[] }>("/notify/projects");
      setProjects(data.projects || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const params = deviceFilter !== "all" ? `?project_id=${deviceFilter}` : "";
      const data = await api<{ devices: Device[] }>(`/notify/devices${params}`);
      setDevices(data.devices || []);
    } catch (e: any) {
      setError(e.message);
    }
  }, [deviceFilter]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api<{ notifications: Notification[]; total: number }>(
        `/notify/notifications?limit=20&offset=${notifPage * 20}`
      );
      setNotifications(data.notifications || []);
      setNotifTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message);
    }
  }, [notifPage]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchHealth(), fetchProjects(), fetchDevices(), fetchNotifications()]);
    setLoading(false);
  }, [fetchHealth, fetchProjects, fetchDevices, fetchNotifications]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Project CRUD ──

  function openCreateForm() {
    setEditProject(null);
    setFormName("");
    setFormDescription("");
    setShowForm(true);
  }

  function openEditForm(project: Project) {
    setEditProject(project);
    setFormName(project.name);
    setFormDescription(project.description || "");
    setShowForm(true);
  }

  async function handleSaveProject() {
    try {
      if (editProject) {
        await api(`/notify/projects/${editProject.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: formName, description: formDescription }),
        });
        toast.success("Project updated");
      } else {
        await api("/notify/projects", {
          method: "POST",
          body: JSON.stringify({ name: formName, description: formDescription }),
        });
        toast.success("Project created");
      }
      setShowForm(false);
      await fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDeleteProject() {
    if (!deleteTarget) return;
    try {
      await api(`/notify/projects/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Project deleted");
      setDeleteTarget(null);
      await fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleRegenerateKey() {
    if (!regenTarget) return;
    try {
      await api(`/notify/projects/${regenTarget.id}/regenerate-key`, { method: "POST" });
      toast.success("API key regenerated");
      setRegenTarget(null);
      await fetchProjects();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleSendTest(project: Project) {
    try {
      await api(`/notify/test/${project.id}`, { method: "POST" });
      toast.success(`Test notification sent to ${project.name}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleViewNotification(notif: Notification) {
    try {
      const data = await api<Notification & { deliveries: Delivery[] }>(`/notify/notifications/${notif.id}`);
      setSelectedNotif(data);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  function toggleKeyVisibility(projectId: number) {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function formatUptime(seconds: number) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function getProjectName(projectId: number) {
    return projects.find((p) => p.id === projectId)?.name || `Project #${projectId}`;
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "projects", label: "Projects", count: projects.length },
    { key: "devices", label: "Devices", count: devices.length },
    { key: "notifications", label: "History", count: notifTotal },
    { key: "health", label: "Service" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={Bell} title="Notifications">
        <button onClick={refresh} className="btn-secondary flex items-center gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </PageHeader>

      {/* Service status bar */}
      {health && (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
          health.reachable ? "bg-cockpit-success/10 border border-cockpit-success/20" : "bg-cockpit-danger/10 border border-cockpit-danger/20"
        }`}>
          <span className={`w-2 h-2 rounded-full ${health.reachable ? "bg-cockpit-success" : "bg-cockpit-danger"}`} />
          <span className={health.reachable ? "text-cockpit-success" : "text-cockpit-danger"}>
            {health.reachable ? "Notify service online" : "Notify service unreachable"}
          </span>
          {health.reachable && health.version && (
            <span className="text-cockpit-text-muted">v{health.version}</span>
          )}
          {health.reachable && health.uptime !== undefined && (
            <span className="text-cockpit-text-muted">Uptime: {formatUptime(health.uptime)}</span>
          )}
          {health.reachable && (
            <span className={`ml-auto text-xs ${health.apns_configured ? "text-cockpit-success" : "text-cockpit-accent"}`}>
              APNs: {health.apns_configured ? "Configured" : "Not configured"}
            </span>
          )}
        </div>
      )}

      <ErrorBanner message={error} onRetry={refresh} />

      {/* Tabs */}
      <div className="flex gap-1 bg-cockpit-bg rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-cockpit-surface text-cockpit-accent border border-cockpit-accent/20"
                : "text-cockpit-text-muted hover:text-cockpit-text"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Projects Tab ── */}
      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openCreateForm} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>

          {projects.length === 0 && !loading ? (
            <div className="text-center py-12 text-cockpit-text-muted">
              No projects yet. Create one to start sending notifications.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{project.name}</h3>
                        <span className="text-xs bg-cockpit-bg px-2 py-0.5 rounded text-cockpit-text-muted font-mono">
                          {project.slug}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-sm text-cockpit-text-muted mt-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleSendTest(project)} className="p-2 hover:bg-white/5 rounded-lg text-cockpit-text-muted hover:text-cockpit-accent" title="Send test notification">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditForm(project)} className="p-2 hover:bg-white/5 rounded-lg text-cockpit-text-muted hover:text-cockpit-text" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(project)} className="p-2 hover:bg-white/5 rounded-lg text-cockpit-text-muted hover:text-cockpit-danger" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* API Key & Webhook URL */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Key className="w-3.5 h-3.5 text-cockpit-text-muted" />
                      <code className="bg-cockpit-bg px-2 py-1 rounded font-mono flex-1 text-cockpit-text-muted">
                        {visibleKeys.has(project.id) ? project.api_key : "ntfy_••••••••••••••••"}
                      </code>
                      <button onClick={() => toggleKeyVisibility(project.id)} className="p-1 hover:bg-white/5 rounded text-cockpit-text-muted" title="Toggle visibility">
                        {visibleKeys.has(project.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => copyToClipboard(project.api_key, "API key")} className="p-1 hover:bg-white/5 rounded text-cockpit-text-muted" title="Copy API key">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setRegenTarget(project)} className="p-1 hover:bg-white/5 rounded text-cockpit-text-muted hover:text-cockpit-accent" title="Regenerate key">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <ExternalLink className="w-3.5 h-3.5 text-cockpit-text-muted" />
                      <code className="bg-cockpit-bg px-2 py-1 rounded font-mono flex-1 text-cockpit-text-muted">
                        POST /api/webhook/{project.slug}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`https://notify.noahsark.me/api/webhook/${project.slug}`, "Webhook URL")}
                        className="p-1 hover:bg-white/5 rounded text-cockpit-text-muted"
                        title="Copy webhook URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <ExternalLink className="w-3.5 h-3.5 text-cockpit-text-muted" />
                      <code className="bg-cockpit-bg px-2 py-1 rounded font-mono flex-1 text-cockpit-text-muted">
                        POST /api/webhook/gitlab/{project.slug}
                      </code>
                      <button
                        onClick={() => copyToClipboard(`https://notify.noahsark.me/api/webhook/gitlab/${project.slug}`, "GitLab webhook URL")}
                        className="p-1 hover:bg-white/5 rounded text-cockpit-text-muted"
                        title="Copy GitLab webhook URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-cockpit-text-muted">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Devices Tab ── */}
      {tab === "devices" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="text-sm text-cockpit-text-muted">
              {devices.length} device{devices.length !== 1 ? "s" : ""}
            </span>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-12 text-cockpit-text-muted">
              <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No devices registered yet. Devices register via the iOS app.
            </div>
          ) : (
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cockpit-border text-cockpit-text-muted text-left">
                    <th className="px-4 py-3 font-medium">Device</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Platform</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id} className="border-b border-cockpit-border/50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-cockpit-text-muted" />
                          <span>{device.label || "Unnamed"}</span>
                        </div>
                        <div className="text-xs text-cockpit-text-muted font-mono mt-0.5">
                          {device.device_token.substring(0, 16)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-cockpit-text-muted">{getProjectName(device.project_id)}</td>
                      <td className="px-4 py-3 text-cockpit-text-muted">{device.platform}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          device.active ? "bg-cockpit-success/10 text-cockpit-success" : "bg-cockpit-danger/10 text-cockpit-danger"
                        }`}>
                          {device.active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {device.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cockpit-text-muted text-xs">
                        {new Date(device.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Notifications Tab ── */}
      {tab === "notifications" && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-cockpit-text-muted">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No notifications sent yet.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleViewNotification(notif)}
                    className="w-full text-left bg-cockpit-surface border border-cockpit-border rounded-lg p-4 hover:border-cockpit-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{notif.title}</h4>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            notif.priority === "high" ? "bg-cockpit-danger/10 text-cockpit-danger" : "bg-cockpit-bg text-cockpit-text-muted"
                          }`}>
                            {notif.priority}
                          </span>
                        </div>
                        {notif.body && <p className="text-xs text-cockpit-text-muted mt-1 line-clamp-1">{notif.body}</p>}
                      </div>
                      <div className="text-xs text-cockpit-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(notif.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-xs text-cockpit-text-muted mt-2">
                      {getProjectName(notif.project_id)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {notifTotal > 20 && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setNotifPage((p) => Math.max(0, p - 1))}
                    disabled={notifPage === 0}
                    className="btn-secondary text-sm"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-cockpit-text-muted">
                    Page {notifPage + 1} of {Math.ceil(notifTotal / 20)}
                  </span>
                  <button
                    onClick={() => setNotifPage((p) => p + 1)}
                    disabled={(notifPage + 1) * 20 >= notifTotal}
                    className="btn-secondary text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Health Tab ── */}
      {tab === "health" && health && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Activity className="w-4 h-4" /> Status
              </div>
              <div className={`text-lg font-bold ${health.reachable ? "text-cockpit-success" : "text-cockpit-danger"}`}>
                {health.reachable ? "Online" : "Offline"}
              </div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Clock className="w-4 h-4" /> Uptime
              </div>
              <div className="text-lg font-bold">
                {health.uptime !== undefined ? formatUptime(health.uptime) : "—"}
              </div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Bell className="w-4 h-4" /> APNs
              </div>
              <div className={`text-lg font-bold ${health.apns_configured ? "text-cockpit-success" : "text-cockpit-accent"}`}>
                {health.apns_configured ? "Configured" : "Not Set"}
              </div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
              <div className="flex items-center gap-2 text-cockpit-text-muted text-sm mb-2">
                <Smartphone className="w-4 h-4" /> Devices
              </div>
              <div className="text-lg font-bold">{health.devices_count ?? "—"}</div>
            </div>
          </div>

          {health.reachable && (
            <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Service Details</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-cockpit-text-muted">Version</span>
                <span>{health.version || "—"}</span>
                <span className="text-cockpit-text-muted">Projects</span>
                <span>{health.projects_count ?? "—"}</span>
                <span className="text-cockpit-text-muted">Devices</span>
                <span>{health.devices_count ?? "—"}</span>
                <span className="text-cockpit-text-muted">APNs</span>
                <span className={health.apns_configured ? "text-cockpit-success" : "text-cockpit-accent"}>
                  {health.apns_configured ? "Configured" : "Not configured — notifications will not be delivered"}
                </span>
              </div>
            </div>
          )}

          {/* Webhook setup instructions */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">GitLab Webhook Setup</h3>
            <div className="text-sm text-cockpit-text-muted space-y-2">
              <p>To receive pipeline and merge request notifications from GitLab:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-2">
                <li>Go to your GitLab project → Settings → Webhooks</li>
                <li>Set URL to: <code className="bg-cockpit-bg px-1.5 py-0.5 rounded text-xs">https://notify.noahsark.me/api/webhook/gitlab/YOUR_PROJECT_SLUG</code></li>
                <li>Set Secret token to the project's API key (ntfy_...)</li>
                <li>Check "Pipeline events" and "Merge request events"</li>
                <li>Click "Add webhook"</li>
              </ol>
            </div>
          </div>

          {/* CI/CD integration example */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-lg p-4">
            <h3 className="font-semibold mb-3">CI/CD Integration</h3>
            <div className="text-sm text-cockpit-text-muted space-y-2">
              <p>Add a notification step to your <code className="bg-cockpit-bg px-1 rounded text-xs">.gitlab-ci.yml</code>:</p>
              <pre className="bg-cockpit-bg p-3 rounded-lg text-xs overflow-x-auto font-mono">
{`notify:
  stage: .post
  image: curlimages/curl:latest
  script:
    - |
      curl -X POST https://notify.noahsark.me/api/webhook/\${PROJECT_SLUG} \\
        -H "Content-Type: application/json" \\
        -H "X-API-Key: \$NOTIFY_API_KEY" \\
        -d "{\\"title\\": \\"Deploy Complete\\", \\"body\\": \\"\$CI_PROJECT_NAME deployed \$CI_COMMIT_SHORT_SHA\\"}"
  when: on_success`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Detail Modal ── */}
      {selectedNotif && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setSelectedNotif(null)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-lg w-full shadow-2xl pointer-events-auto max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Notification #{selectedNotif.id}</h3>
                <button onClick={() => setSelectedNotif(null)} className="text-cockpit-text-muted hover:text-cockpit-text">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-cockpit-text-muted">Title:</span>
                  <p className="font-medium">{selectedNotif.title}</p>
                </div>
                {selectedNotif.body && (
                  <div>
                    <span className="text-cockpit-text-muted">Body:</span>
                    <p>{selectedNotif.body}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <div>
                    <span className="text-cockpit-text-muted">Priority:</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      selectedNotif.priority === "high" ? "bg-cockpit-danger/10 text-cockpit-danger" : "bg-cockpit-bg text-cockpit-text-muted"
                    }`}>
                      {selectedNotif.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-cockpit-text-muted">Sent:</span>
                    <span className="ml-2">{new Date(selectedNotif.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {selectedNotif.data && selectedNotif.data !== "{}" && (
                  <div>
                    <span className="text-cockpit-text-muted">Data:</span>
                    <pre className="bg-cockpit-bg p-2 rounded mt-1 text-xs overflow-x-auto font-mono">
                      {JSON.stringify(JSON.parse(selectedNotif.data), null, 2)}
                    </pre>
                  </div>
                )}

                {/* Deliveries */}
                {selectedNotif.deliveries && selectedNotif.deliveries.length > 0 && (
                  <div>
                    <span className="text-cockpit-text-muted">Deliveries:</span>
                    <div className="mt-2 space-y-2">
                      {selectedNotif.deliveries.map((d) => (
                        <div key={d.id} className="bg-cockpit-bg rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {d.status === "sent" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-cockpit-success" />
                            ) : d.status === "failed" ? (
                              <XCircle className="w-3.5 h-3.5 text-cockpit-danger" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-cockpit-accent" />
                            )}
                            <span>Device #{d.device_id}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={
                              d.status === "sent" ? "text-cockpit-success" : d.status === "failed" ? "text-cockpit-danger" : "text-cockpit-accent"
                            }>
                              {d.status}
                            </span>
                            {d.error && <span className="text-cockpit-danger">{d.error}</span>}
                            {d.sent_at && <span className="text-cockpit-text-muted">{new Date(d.sent_at).toLocaleTimeString()}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Project Form Modal ── */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto">
              <h3 className="text-lg font-bold mb-4">{editProject ? "Edit Project" : "New Project"}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-cockpit-text-muted block mb-1">Name</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm"
                    placeholder="My Project"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm text-cockpit-text-muted block mb-1">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm h-20 resize-none"
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleSaveProject} className="btn-primary" disabled={!formName.trim()}>
                    {editProject ? "Save" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Confirm Dialogs ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Project"
        message={`Delete "${deleteTarget?.name}"? This will remove all associated devices and notifications.`}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={!!regenTarget}
        title="Regenerate API Key"
        message={`Regenerate the API key for "${regenTarget?.name}"? The old key will stop working immediately.`}
        onConfirm={handleRegenerateKey}
        onCancel={() => setRegenTarget(null)}
      />
    </div>
  );
}
