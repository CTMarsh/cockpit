import { useState } from "react";
import { Rocket, LogIn } from "lucide-react";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Connection failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-cockpit-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cockpit-accent flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Cockpit</h1>
          <p className="text-cockpit-text-muted text-sm mt-1">NoahsArk Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-2.5 text-sm text-cockpit-danger">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-cockpit-text-muted">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-cockpit-text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
