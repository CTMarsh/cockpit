import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import {
  Database,
  RefreshCw,
  FolderOpen,
  File,
  Download,
  Trash2,
  Upload,
  Plus,
  ChevronRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export function S3BrowserPage() {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [currentBucket, setCurrentBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ type: "bucket" | "object"; name: string } | null>(null);
  const [showNewBucket, setShowNewBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ available: boolean; buckets: string[] }>("/s3/buckets");
      setAvailable(data.available);
      setBuckets(data.buckets);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchObjects = useCallback(async () => {
    if (!currentBucket) return;
    try {
      setLoading(true);
      setError("");
      const data = await api<{ prefixes: string[]; objects: S3Object[] }>(
        `/s3/objects/${currentBucket}?prefix=${encodeURIComponent(prefix)}`
      );
      setPrefixes(data.prefixes);
      setObjects(data.objects);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentBucket, prefix]);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);
  useEffect(() => { if (currentBucket) fetchObjects(); }, [fetchObjects, currentBucket]);

  function enterBucket(bucket: string) {
    setCurrentBucket(bucket);
    setPrefix("");
    setPrefixes([]);
    setObjects([]);
  }

  function enterPrefix(p: string) {
    setPrefix(p);
  }

  function goUp() {
    if (!prefix) {
      setCurrentBucket("");
      return;
    }
    const parts = prefix.replace(/\/$/, "").split("/");
    parts.pop();
    setPrefix(parts.length ? parts.join("/") + "/" : "");
  }

  // Breadcrumb segments
  const breadcrumbs: { label: string; action: () => void }[] = [
    { label: "Buckets", action: () => { setCurrentBucket(""); setPrefix(""); } },
  ];
  if (currentBucket) {
    breadcrumbs.push({ label: currentBucket, action: () => setPrefix("") });
    if (prefix) {
      const parts = prefix.replace(/\/$/, "").split("/");
      parts.forEach((part, i) => {
        const p = parts.slice(0, i + 1).join("/") + "/";
        breadcrumbs.push({ label: part, action: () => setPrefix(p) });
      });
    }
  }

  async function createBucket() {
    if (!newBucketName) return;
    try {
      await api("/s3/buckets", { method: "POST", body: JSON.stringify({ name: newBucketName }) });
      toast.success(`Bucket "${newBucketName}" created`);
      setShowNewBucket(false);
      setNewBucketName("");
      fetchBuckets();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "bucket") {
        await api(`/s3/buckets/${deleteTarget.name}`, { method: "DELETE" });
        toast.success(`Bucket deleted`);
        fetchBuckets();
      } else {
        await api(`/s3/objects/${currentBucket}/${deleteTarget.name}`, { method: "DELETE" });
        toast.success(`Object deleted`);
        fetchObjects();
      }
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentBucket) return;
    try {
      const key = prefix + file.name;
      const body = new Uint8Array(await file.arrayBuffer());
      await fetch(`/api/s3/upload/${currentBucket}/${key}`, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body,
        credentials: "include",
      });
      toast.success(`Uploaded ${file.name}`);
      fetchObjects();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!available && !loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-cockpit-accent" /> S3 Browser
        </h2>
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-8 text-center">
          <Database className="w-12 h-12 text-cockpit-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">S3 Storage Not Configured</h3>
          <p className="text-cockpit-text-muted text-sm">
            Set <code className="px-1.5 py-0.5 bg-cockpit-bg rounded text-xs">S3_ENDPOINT</code>,{" "}
            <code className="px-1.5 py-0.5 bg-cockpit-bg rounded text-xs">S3_ACCESS_KEY</code>, and{" "}
            <code className="px-1.5 py-0.5 bg-cockpit-bg rounded text-xs">S3_SECRET_KEY</code> environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-cockpit-accent" /> S3 Browser
        </h2>
        <div className="flex gap-2">
          {currentBucket && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25">
                <Upload className="w-4 h-4" /> Upload
              </button>
            </>
          )}
          {!currentBucket && (
            <button onClick={() => setShowNewBucket(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25">
              <Plus className="w-4 h-4" /> New Bucket
            </button>
          )}
          <button onClick={currentBucket ? fetchObjects : fetchBuckets} disabled={loading} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-cockpit-text-muted">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 opacity-40" />}
            {i < breadcrumbs.length - 1 ? (
              <button onClick={bc.action} className="hover:text-cockpit-text transition-colors">{bc.label}</button>
            ) : (
              <span className="text-cockpit-text font-medium">{bc.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Back button when inside a bucket */}
      {currentBucket && (
        <button onClick={goUp} className="flex items-center gap-2 text-sm text-cockpit-text-muted hover:text-cockpit-text">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}

      {/* Bucket list */}
      {!currentBucket && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {buckets.map((b) => (
            <button
              key={b}
              onClick={() => enterBucket(b)}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            >
              <FolderOpen className="w-5 h-5 text-cockpit-accent shrink-0" />
              <span className="text-sm font-medium truncate">{b}</span>
              <Trash2
                className="w-4 h-4 text-cockpit-text-muted hover:text-cockpit-danger ml-auto shrink-0"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "bucket", name: b }); }}
              />
            </button>
          ))}
          {buckets.length === 0 && !loading && (
            <div className="col-span-full text-center text-cockpit-text-muted py-8">No buckets found.</div>
          )}
        </div>
      )}

      {/* Object list */}
      {currentBucket && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-hidden">
          {/* Folder prefixes */}
          {prefixes.map((p) => (
            <button
              key={p}
              onClick={() => enterPrefix(p)}
              className="w-full px-4 py-3 flex items-center gap-3 border-b border-cockpit-border hover:bg-white/5 text-left"
            >
              <FolderOpen className="w-4 h-4 text-cockpit-accent shrink-0" />
              <span className="text-sm font-medium">{p.replace(prefix, "").replace(/\/$/, "")}/</span>
            </button>
          ))}
          {/* Files */}
          {objects.map((obj) => (
            <div key={obj.key} className="px-4 py-3 flex items-center gap-3 border-b border-cockpit-border last:border-b-0">
              <File className="w-4 h-4 text-cockpit-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{obj.key.replace(prefix, "")}</div>
                <div className="text-[10px] text-cockpit-text-muted">
                  {formatBytes(obj.size)} · {new Date(obj.lastModified).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={`/api/s3/download/${currentBucket}/${obj.key}`}
                  className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-accent hover:bg-white/5"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setDeleteTarget({ type: "object", name: obj.key })}
                  className="p-1.5 rounded-md text-cockpit-text-muted hover:text-cockpit-danger hover:bg-white/5"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {prefixes.length === 0 && objects.length === 0 && !loading && (
            <div className="text-center text-cockpit-text-muted py-8">Empty — upload files to get started.</div>
          )}
        </div>
      )}

      {/* New bucket modal */}
      {showNewBucket && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/50" onClick={() => setShowNewBucket(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-sm w-full shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">New Bucket</h3>
                <button onClick={() => setShowNewBucket(false)} className="text-cockpit-text-muted hover:text-cockpit-text"><X className="w-5 h-5" /></button>
              </div>
              <input value={newBucketName} onChange={(e) => setNewBucketName(e.target.value.toLowerCase())} placeholder="bucket-name" className="w-full px-3 py-2 bg-cockpit-bg border border-cockpit-border rounded-lg text-sm focus:outline-none focus:border-cockpit-accent mb-3" />
              <p className="text-[10px] text-cockpit-text-muted mb-4">Lowercase letters, numbers, hyphens, and dots. 3-63 characters.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewBucket(false)} className="px-4 py-2 text-sm text-cockpit-text-muted">Cancel</button>
                <button onClick={createBucket} disabled={!newBucketName} className="px-4 py-2 text-sm bg-cockpit-accent text-white rounded-lg hover:bg-cockpit-accent/80 disabled:opacity-50">Create</button>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title={`Delete ${deleteTarget.type === "bucket" ? "Bucket" : "Object"}`}
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
