import { useEffect, useState } from "react";
import { Watch, CheckCircle, XCircle, Loader2 } from "lucide-react";

export function LinkDevicePage() {
  const [code, setCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState<"input" | "approving" | "approved" | "error">("input");
  const [error, setError] = useState("");

  // Auto-fill from URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    if (urlCode) {
      setCode(urlCode.toUpperCase());
      approve(urlCode.toUpperCase());
    }
  }, []);

  async function approve(deviceCode: string) {
    setStatus("approving");
    setError("");
    try {
      const res = await fetch(`/api/auth/device-code/${deviceCode}/approve`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setStatus("approved");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to approve");
        setStatus("error");
      }
    } catch {
      setError("Connection failed");
      setStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const c = manualCode.toUpperCase().replace(/\s/g, "");
    if (c.length === 6) {
      setCode(c);
      approve(c);
    }
  }

  return (
    <div className="min-h-screen bg-cockpit-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Watch className="w-12 h-12 text-cockpit-accent mx-auto mb-3" />
          <h1 className="text-xl font-bold text-cockpit-text">Link Device</h1>
          <p className="text-cockpit-text-muted text-sm mt-1">
            Approve a device login request
          </p>
        </div>

        <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6">
          {status === "input" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-cockpit-text-muted">
                  Enter the code shown on your device
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.3em] focus:outline-none focus:border-cockpit-accent text-cockpit-text uppercase"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={manualCode.replace(/\s/g, "").length !== 6}
                className="w-full px-4 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover text-cockpit-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Approve Login
              </button>
            </form>
          )}

          {status === "approving" && (
            <div className="text-center py-4">
              <Loader2 className="w-8 h-8 text-cockpit-accent mx-auto mb-3 animate-spin" />
              <p className="text-cockpit-text">Approving code {code}...</p>
            </div>
          )}

          {status === "approved" && (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-cockpit-success mx-auto mb-3" />
              <p className="text-cockpit-text font-semibold">Device Linked!</p>
              <p className="text-cockpit-text-muted text-sm mt-1">
                Your device is now signed in. You can close this page.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-4">
              <XCircle className="w-12 h-12 text-cockpit-danger mx-auto mb-3" />
              <p className="text-cockpit-text font-semibold">Failed</p>
              <p className="text-cockpit-danger text-sm mt-1">{error}</p>
              <button
                onClick={() => { setStatus("input"); setManualCode(""); }}
                className="mt-4 px-4 py-2 bg-cockpit-surface border border-cockpit-border rounded-lg text-sm text-cockpit-text hover:border-cockpit-accent transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
