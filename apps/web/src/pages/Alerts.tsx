import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  Bell,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  TestTube,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

type Tab = "rules" | "history";

interface AlertRule {
  id: string;
  name: string;
  metric_type: string;
  operator: string;
  threshold: number;
  target: string;
  cooldown_minutes: number;
  enabled: number;
  webhook_url: string;
  created_at: string;
  updated_at: string;
}

interface AlertEvent {
  id: number;
  rule_id: string;
  rule_name: string;
  metric_type: string;
  value: number;
  threshold: number;
  message: string;
  fired_at: string;
}

const METRIC_LABELS: Record<string, string> = {
  cpu: "CPU %",
  memory: "Memory %",
  disk: "Disk %",
  service_down: "Service Down",
  pod_restarts: "Pod Restarts",
};

const OPERATOR_LABELS: Record<string, string> = {
  gt: ">",
  lt: "<",
  gte: ">=",
  lte: "<=",
  eq: "=",
};

export function AlertsPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [history, setHistory] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);
  const toast = useToast();

  // Form state
  const [formName, setFormName] = useState("");
  const [formMetric, setFormMetric] = useState("cpu");
  const [formOperator, setFormOperator] = useState("gt");
  const [formThreshold, setFormThreshold] = useState(80);
  const [formTarget, setFormTarget] = useState("");
  const [formCooldown, setFormCooldown] = useState(15);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formWebhook, setFormWebhook] = useState("");

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ rules: AlertRule[] }>("/alerts/rules");
      setRules(data.rules);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await api<{ history: AlertEvent[] }>("/alerts/history?limit=100");
      setHistory(data.history);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRules(); fetchHistory(); }, [fetchRules, fetchHistory]);

  function openNewForm() {
    setEditRule(null);
    setFormName(""); setFormMetric("cpu"); setFormOperator("gt");
    setFormThreshold(80); setFormTarget(""); setFormCooldown(15);
    setFormEnabled(true); setFormWebhook("");
    setShowForm(true);
  }

  function openEditForm(rule: AlertRule) {
    setEditRule(rule);
    setFormName(rule.name); setFormMetric(rule.metric_type);
    setFormOperator(rule.operator); setFormThreshold(rule.threshold);
    setFormTarget(rule.target); setFormCooldown(rule.cooldown_minutes);
    setFormEnabled(!!rule.enabled); setFormWebhook(rule.webhook_url);
    setShowForm(true);
  }

  async function saveRule() {
    try {
      const body = {
        name: formName, metric_type: formMetric, operator: formOperator,
        threshold: formThreshold, target: formTarget, cooldown_minutes: formCooldown,
        enabled: formEnabled, webhook_url: formWebhook,
      };
      if (editRule) {
        await api(`/alerts/rules/${editRule.id}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("Rule updated");
      } else {
        await api("/alerts/rules", { method: "POST", body: JSON.stringify(body) });
        toast.success("Rule created");
      }
      setShowForm(false);
      fetchRules();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function deleteRule() {
    if (!deleteTarget) return;
    try {
      await api(`/alerts/rules/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Rule deleted");
      setDeleteTarget(null);
      fetchRules();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function testRule(rule: AlertRule) {
    try {
      await api(`/alerts/test/${rule.id}`, { method: "POST" });
      toast.info("Test alert fired");
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "rules", label: `Rules (${rules.length})` },
    { key: "history", label: `History (${history.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-cockpit-accent" /> Alert Rules
        </h2>
        <div className="flex gap-2">
          <button onClick={openNewForm} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors">
            <Plus className="w-4 h-4" /> New Rule
          </button>
          <button onClick={() => { fetchRules(); fetchHistory(); }} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-1 bg-cockpit-surface border border-cockpit-border rounded-lg p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? "bg-cockpit-accent/15 text-cockpit-accent" : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="space-y-2">
          {rules.length === 0 && !loading && (
            <div className="text-center text-cockpit-text-muted py-8">No alert rules configured. Create one to get started.</div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full shrink-0 ${rule.enabled ? "bg-cockpit-success" : "bg-cockpit-text-muted"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{rule.name}</div>
                <div className="text-xs text-cockpit-text-muted">
                  {METRIC_LABELS[rule.metric_type] || rule.metric_type}{" "}
                  {OPERATOR_LABELS[rule.operator] || rule.operator}{" "}
                  {rule.threshold}{rule.target ? ` on ${rule.target}` : ""}
                  {" · "}{rule.cooldown_minutes}m cooldown
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => testRule(rule)} title="Test fire" className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-accent hover:bg-white/5"><TestTube className="w-4 h-4" /></button>
                <button onClick={() => openEditForm(rule)} title="Edit" className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(rule)} title="Delete" className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 && <div className="text-center text-cockpit-text-muted py-8">No alert history.</div>}
          {history.map((evt) => (
            <div key={evt.id} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-cockpit-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{evt.rule_name}</div>
                <div className="text-xs text-cockpit-text-muted">{evt.message}</div>
                <div className="text-[10px] text-cockpit-text-muted mt-1">
                  {METRIC_LABELS[evt.metric_type] || evt.metric_type}: {evt.value} (threshold: {evt.threshold})
                  {" · "}{new Date(evt.fired_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{editRule ? "Edit Rule" : "New Alert Rule"}</h3>
                <button onClick={() => setShowForm(false)} className="text-cockpit-text-muted hover:text-cockpit-text"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">Name</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent" placeholder="High CPU Alert" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">Metric</label>
                    <select value={formMetric} onChange={(e) => setFormMetric(e.target.value)} className="w-full px-2 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm">
                      {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">Operator</label>
                    <select value={formOperator} onChange={(e) => setFormOperator(e.target.value)} className="w-full px-2 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm">
                      {Object.entries(OPERATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">Threshold</label>
                    <input type="number" value={formThreshold} onChange={(e) => setFormThreshold(Number(e.target.value))} className="w-full px-2 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">Target (optional)</label>
                  <input value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm" placeholder="e.g., cockpit-api" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">Cooldown (min)</label>
                    <input type="number" value={formCooldown} onChange={(e) => setFormCooldown(Number(e.target.value))} className="w-full px-2 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={formEnabled} onChange={(e) => setFormEnabled(e.target.checked)} className="rounded" />
                      Enabled
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">Webhook URL (optional)</label>
                  <input value={formWebhook} onChange={(e) => setFormWebhook(e.target.value)} className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm" placeholder="https://hooks.example.com/..." />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-cockpit-text-muted hover:text-cockpit-text">Cancel</button>
                <button onClick={saveRule} disabled={!formName} className="px-4 py-2 text-sm bg-cockpit-accent text-white rounded-lg hover:bg-cockpit-accent/80 disabled:opacity-50">{editRule ? "Update" : "Create"}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Alert Rule"
          message={`Delete "${deleteTarget.name}"? This will also clear its alert history.`}
          confirmLabel="Delete"
          onConfirm={deleteRule}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
