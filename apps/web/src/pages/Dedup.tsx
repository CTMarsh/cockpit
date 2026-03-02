import { useState } from "react";
import { api } from "../api";
import { HardDrive, Search, Loader2, FileIcon, Trash2, AlertTriangle, X } from "lucide-react";

interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

interface ScanResult {
  id: string;
  directory: string;
  status: "scanning" | "complete" | "error";
  totalFiles: number;
  duplicateGroups: DuplicateGroup[];
  reclaimableBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DedupPage() {
  const [directory, setDirectory] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function startScan(e: React.FormEvent) {
    e.preventDefault();
    if (!directory) return;
    setScanning(true);
    setResult(null);
    setSelected(new Set());

    const { id } = await api<{ id: string }>("/dedup/scan", {
      method: "POST",
      body: JSON.stringify({ directory }),
    });

    const poll = async () => {
      const scan = await api<ScanResult>(`/dedup/scan/${id}`);
      if (scan.status === "scanning") {
        setTimeout(poll, 1000);
      } else {
        setResult(scan);
        setScanning(false);
      }
    };
    poll();
  }

  function toggleFile(file: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  function selectAllDupes() {
    if (!result) return;
    const dupes = new Set<string>();
    for (const group of result.duplicateGroups) {
      // Select all EXCEPT the first file (keep original)
      for (let i = 1; i < group.files.length; i++) {
        dupes.add(group.files[i]);
      }
    }
    setSelected(dupes);
  }

  async function confirmDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    await api("/dedup/delete", {
      method: "POST",
      body: JSON.stringify({ files: [...selected], confirmed: true }),
    });
    setDeleting(false);
    setShowConfirm(false);
    setSelected(new Set());
    // Re-scan to refresh results
    if (directory) {
      const form = { preventDefault: () => {} } as React.FormEvent;
      startScan(form);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-cockpit-accent" />
          File Deduplicator
        </h2>
        <p className="text-cockpit-text-muted mt-1">Find duplicate files and reclaim disk space</p>
      </div>

      {/* Scan Form */}
      <form onSubmit={startScan} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
          <input
            type="text"
            placeholder="Directory to scan (e.g., /home/chris/documents)"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            className="w-full bg-cockpit-surface border border-cockpit-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
          />
        </div>
        <button
          type="submit"
          disabled={scanning || !directory}
          className="px-6 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Scanning...
            </>
          ) : (
            "Scan"
          )}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
              <div className="text-cockpit-text-muted text-sm">Files Scanned</div>
              <div className="text-3xl font-bold mt-1">{result.totalFiles.toLocaleString()}</div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
              <div className="text-cockpit-warning text-sm">Duplicate Groups</div>
              <div className="text-3xl font-bold mt-1 text-cockpit-warning">
                {result.duplicateGroups.length}
              </div>
            </div>
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5">
              <div className="text-cockpit-success text-sm">Reclaimable Space</div>
              <div className="text-3xl font-bold mt-1 text-cockpit-success">
                {formatBytes(result.reclaimableBytes)}
              </div>
            </div>
          </div>

          {/* Action bar */}
          {result.duplicateGroups.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllDupes}
                className="px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm"
              >
                Select all duplicates (keep originals)
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-cockpit-danger/10 border border-cockpit-danger/30 text-cockpit-danger hover:bg-cockpit-danger/20 transition-colors text-sm flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selected.size} file{selected.size !== 1 ? "s" : ""}
                </button>
              )}
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-cockpit-text-muted hover:text-cockpit-text text-sm"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          {/* Duplicate Groups */}
          {result.duplicateGroups.length === 0 ? (
            <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-12 text-center text-cockpit-text-muted">
              No duplicates found. Your files are clean!
            </div>
          ) : (
            <div className="space-y-3">
              {result.duplicateGroups.map((group) => (
                <div
                  key={group.hash}
                  className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-cockpit-text-muted font-mono">
                      SHA-256: {group.hash.slice(0, 16)}...
                    </span>
                    <span className="text-sm">
                      {formatBytes(group.size)} each &middot;{" "}
                      <span className="text-cockpit-success">
                        {formatBytes(group.size * (group.files.length - 1))} reclaimable
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.files.map((file, i) => (
                      <label
                        key={file}
                        className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded cursor-pointer transition-colors ${
                          selected.has(file) ? "bg-cockpit-danger/5" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(file)}
                          onChange={() => toggleFile(file)}
                          className="accent-cockpit-danger"
                        />
                        <FileIcon className="w-3.5 h-3.5 text-cockpit-text-muted shrink-0" />
                        <span className="font-mono text-xs truncate">{file}</span>
                        {i === 0 ? (
                          <span className="ml-auto text-xs text-cockpit-success px-2 py-0.5 rounded bg-cockpit-success/10">
                            original
                          </span>
                        ) : (
                          <span className="ml-auto text-xs text-cockpit-warning px-2 py-0.5 rounded bg-cockpit-warning/10">
                            duplicate
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !scanning && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-12 text-center text-cockpit-text-muted">
          Enter a directory path above and click Scan to find duplicates
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-cockpit-danger/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-cockpit-danger" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold">Confirm Deletion</h3>
                <p className="text-sm text-cockpit-text-muted mt-2">
                  You are about to permanently delete <strong className="text-cockpit-text">{selected.size}</strong> file{selected.size !== 1 ? "s" : ""}. This action cannot be undone.
                </p>
                <div className="mt-3 max-h-40 overflow-y-auto bg-cockpit-bg rounded-lg p-3">
                  {[...selected].map((file) => (
                    <div key={file} className="text-xs font-mono text-cockpit-text-muted truncate py-0.5">
                      {file}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-cockpit-border hover:border-cockpit-accent/50 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 rounded-lg bg-cockpit-danger hover:bg-red-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Files
                  </button>
                </div>
              </div>
              <button onClick={() => setShowConfirm(false)} className="text-cockpit-text-muted hover:text-cockpit-text">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
