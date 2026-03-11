import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  X,
  Cloud,
  CloudOff,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  created_on: string;
  modified_on: string;
}

interface ZoneInfo {
  id: string;
  name: string;
  status: string;
}

const TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-500/20 text-blue-400",
  AAAA: "bg-purple-500/20 text-purple-400",
  CNAME: "bg-green-500/20 text-green-400",
  MX: "bg-yellow-500/20 text-yellow-400",
  TXT: "bg-gray-500/20 text-gray-400",
  NS: "bg-red-500/20 text-red-400",
  SRV: "bg-orange-500/20 text-orange-400",
};

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"];
const PROXYABLE_TYPES = new Set(["A", "AAAA", "CNAME"]);
const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/;

export function DnsManagerPage() {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [zone, setZone] = useState<ZoneInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<DnsRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DnsRecord | null>(null);
  const toast = useToast();

  // Form state
  const [formType, setFormType] = useState("A");
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formTtl, setFormTtl] = useState(1);
  const [formProxied, setFormProxied] = useState(false);
  const [formSaving, setFormSaving] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api<{ configured: boolean }>("/dns/health");
      setConfigured(data.configured);
    } catch {
      setConfigured(false);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ records: DnsRecord[] }>("/dns/records");
      setRecords(data.records);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchZone = useCallback(async () => {
    try {
      const data = await api<{ zone: ZoneInfo }>("/dns/zone");
      setZone(data.zone);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchRecords();
    fetchZone();
  }, [fetchHealth, fetchRecords, fetchZone]);

  function openNewForm() {
    setEditRecord(null);
    setFormType("A");
    setFormName("");
    setFormContent("");
    setFormTtl(1);
    setFormProxied(false);
    setShowForm(true);
  }

  function openEditForm(record: DnsRecord) {
    setEditRecord(record);
    setFormType(record.type);
    setFormName(record.name);
    setFormContent(record.content);
    setFormTtl(record.ttl);
    setFormProxied(record.proxied);
    setShowForm(true);
  }

  async function saveRecord() {
    try {
      setFormSaving(true);
      const body = {
        type: formType,
        name: formName,
        content: formContent,
        ttl: formTtl,
        proxied: PROXYABLE_TYPES.has(formType) ? formProxied : false,
      };
      if (editRecord) {
        await api(`/dns/records/${editRecord.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast.success("Record updated");
      } else {
        await api("/dns/records", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Record created");
      }
      setShowForm(false);
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setFormSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget) return;
    try {
      await api(`/dns/records/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Record deleted");
      setDeleteTarget(null);
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const isInternalIp = PRIVATE_IP_RE.test(formContent);
  const showProxyWarning =
    isInternalIp && PROXYABLE_TYPES.has(formType) && formProxied;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-cockpit-accent" /> DNS Manager
          </h2>
          {zone && (
            <p className="text-sm text-cockpit-text-muted mt-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Zone: <span className="text-cockpit-text font-medium">{zone.name}</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-cockpit-success/20 text-cockpit-success uppercase">
                {zone.status}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={openNewForm}
            disabled={!configured}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
          <button
            onClick={() => {
              fetchRecords();
              fetchZone();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Not configured banner */}
      {!configured && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-yellow-400">
              Cloudflare Not Configured
            </div>
            <div className="text-xs text-cockpit-text-muted mt-1">
              Set <code className="px-1 py-0.5 bg-white/5 rounded">CLOUDFLARE_API_TOKEN</code> and{" "}
              <code className="px-1 py-0.5 bg-white/5 rounded">CLOUDFLARE_ZONE_ID</code> environment
              variables to enable DNS management.
            </div>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Records table */}
      <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cockpit-border text-cockpit-text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Content</th>
              <th className="text-left px-4 py-3">TTL</th>
              <th className="text-left px-4 py-3">Proxy</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-cockpit-text-muted py-8"
                >
                  {configured
                    ? "No DNS records found."
                    : "Configure Cloudflare credentials to view records."}
                </td>
              </tr>
            )}
            {records.map((record) => (
              <tr
                key={record.id}
                className="border-b border-cockpit-border/50 hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-mono font-medium rounded ${TYPE_COLORS[record.type] || "bg-gray-500/20 text-gray-400"}`}
                  >
                    {record.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                  {record.name}
                </td>
                <td className="px-4 py-3 text-cockpit-text-muted truncate max-w-[250px] font-mono text-xs">
                  {record.content}
                </td>
                <td className="px-4 py-3 text-cockpit-text-muted">
                  {record.ttl === 1 ? "Auto" : `${record.ttl}s`}
                </td>
                <td className="px-4 py-3">
                  {PROXYABLE_TYPES.has(record.type) ? (
                    record.proxied ? (
                      <span title="Proxied"><Cloud className="w-4 h-4 text-orange-400" /></span>
                    ) : (
                      <span title="DNS only"><CloudOff
                        className="w-4 h-4 text-cockpit-text-muted"
                      /></span>
                    )
                  ) : (
                    <span className="text-xs text-cockpit-text-muted">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => openEditForm(record)}
                      title="Edit"
                      className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(record)}
                      title="Delete"
                      className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && records.length === 0 && (
          <div className="text-center text-cockpit-text-muted py-8">
            Loading DNS records...
          </div>
        )}
      </div>

      <div className="text-xs text-cockpit-text-muted text-right">
        {records.length} record{records.length !== 1 ? "s" : ""}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/50"
            onClick={() => setShowForm(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-md w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {editRecord ? "Edit Record" : "New DNS Record"}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-cockpit-text-muted hover:text-cockpit-text"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value);
                      if (!PROXYABLE_TYPES.has(e.target.value)) {
                        setFormProxied(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                  >
                    {RECORD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">
                    Name
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="subdomain.example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-cockpit-text-muted block mb-1">
                    Content
                  </label>
                  <input
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder={
                      formType === "A"
                        ? "192.0.2.1"
                        : formType === "CNAME"
                          ? "target.example.com"
                          : formType === "MX"
                            ? "mail.example.com"
                            : "value"
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-cockpit-text-muted block mb-1">
                      TTL
                    </label>
                    <input
                      type="number"
                      value={formTtl}
                      onChange={(e) => setFormTtl(Number(e.target.value))}
                      min={1}
                      className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent"
                    />
                    <span className="text-[10px] text-cockpit-text-muted">
                      1 = Auto
                    </span>
                  </div>
                  {PROXYABLE_TYPES.has(formType) && (
                    <div className="flex items-end pb-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formProxied}
                          onChange={(e) => setFormProxied(e.target.checked)}
                          className="rounded"
                        />
                        <Cloud className="w-4 h-4 text-orange-400" />
                        Proxied
                      </label>
                    </div>
                  )}
                </div>

                {/* Internal IP warning */}
                {isInternalIp && PROXYABLE_TYPES.has(formType) && (
                  <div
                    className={`flex items-start gap-2 p-3 rounded-lg text-xs ${
                      showProxyWarning
                        ? "bg-red-500/10 border border-red-500/30 text-red-400"
                        : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {showProxyWarning
                        ? "Internal IPs cannot be proxied. The server will reject this request."
                        : "Warning: This looks like an internal IP address. It cannot be proxied through Cloudflare."}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-cockpit-text-muted hover:text-cockpit-text"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRecord}
                  disabled={!formName || !formContent || formSaving}
                  className="px-4 py-2 text-sm bg-cockpit-accent text-white rounded-lg hover:bg-cockpit-accent/80 disabled:opacity-50"
                >
                  {formSaving
                    ? "Saving..."
                    : editRecord
                      ? "Update"
                      : "Create"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete DNS Record"
          message={`Delete ${deleteTarget.type} record "${deleteTarget.name}" pointing to "${deleteTarget.content}"?`}
          confirmLabel="Delete"
          onConfirm={deleteRecord}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
