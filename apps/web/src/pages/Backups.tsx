import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  HardDriveDownload,
  RefreshCw,
  Download,
  Plus,
  Database,
  FileArchive,
} from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";
import { useToast } from "../components/Toast";

interface Backup {
  key: string;
  name: string;
  size: number;
  sizeHuman: string;
  lastModified: string;
}

interface BackupListResponse {
  available: boolean;
  backups: Backup[];
}

interface BackupHealthResponse {
  available: boolean;
  bucket: string;
}

interface BackupTriggerResponse {
  ok: true;
  key: string;
  originalSize: number;
  compressedSize: number;
  timestamp: string;
}

export function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<BackupHealthResponse | null>(null);
  const [triggering, setTriggering] = useState(false);
  const toast = useToast();

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<BackupListResponse>("/backup/list");
      setBackups(data.backups);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api<BackupHealthResponse>("/backup/health");
      setHealth(data);
    } catch {
      setHealth({ available: false, bucket: "" });
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchHealth();
  }, [fetchBackups, fetchHealth]);

  async function triggerBackup() {
    try {
      setTriggering(true);
      const result = await api<BackupTriggerResponse>("/backup/trigger", {
        method: "POST",
      });
      toast.success(
        `Backup created successfully (${formatBytes(result.compressedSize)})`
      );
      fetchBackups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTriggering(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  const s3Available = health?.available ?? false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <HardDriveDownload className="w-6 h-6 text-cockpit-accent" /> Backups
        </h2>
        <div className="flex items-center gap-3">
          {/* S3 health indicator */}
          <div className="flex items-center gap-2 text-sm text-cockpit-text-muted">
            <div
              className={`w-2 h-2 rounded-full ${s3Available ? "bg-cockpit-success" : "bg-cockpit-danger"}`}
            />
            S3 {s3Available ? "Connected" : "Unavailable"}
          </div>

          <button
            onClick={triggerBackup}
            disabled={triggering || !s3Available}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-accent/15 text-cockpit-accent border border-cockpit-accent/30 rounded-lg hover:bg-cockpit-accent/25 transition-colors disabled:opacity-50"
          >
            <Plus className={`w-4 h-4 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Creating..." : "Create Backup Now"}
          </button>
          <button
            onClick={() => {
              fetchBackups();
              fetchHealth();
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

      {error && <ErrorBanner message={error} onRetry={fetchBackups} />}

      {/* Backup list */}
      <div className="space-y-2">
        {backups.length === 0 && !loading && (
          <div className="text-center py-12">
            <Database className="w-10 h-10 text-cockpit-text-muted mx-auto mb-3 opacity-50" />
            <div className="text-cockpit-text-muted text-sm">
              No backups found. Create one to get started.
            </div>
          </div>
        )}
        {backups.map((backup) => (
          <div
            key={backup.key}
            className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 flex items-center gap-4"
          >
            <FileArchive className="w-5 h-5 text-cockpit-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{backup.name}</div>
              <div className="text-xs text-cockpit-text-muted">
                {backup.sizeHuman} {" \u00b7 "}
                {formatDate(backup.lastModified)}
              </div>
            </div>
            <a
              href={`/api/backup/download/${encodeURIComponent(backup.key)}`}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors text-cockpit-text-muted hover:text-cockpit-text shrink-0"
              download
            >
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        ))}
      </div>

      {loading && backups.length === 0 && (
        <div className="text-center py-8 text-cockpit-text-muted text-sm">
          Loading backups...
        </div>
      )}
    </div>
  );
}
