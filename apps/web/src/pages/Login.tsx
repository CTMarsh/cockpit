import { useState } from "react";
import { LogIn } from "lucide-react";

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
    <div className="min-h-screen bg-cockpit-bg relative overflow-hidden flex items-center justify-center lg:justify-end">
      {/* Background artwork */}
      <div
        className="absolute inset-0 bg-cover bg-left bg-no-repeat opacity-50 lg:opacity-60"
        style={{ backgroundImage: "url(/ark-login-bg.jpg)" }}
      />
      {/* Gradient overlay — fades from right (form) to left (artwork) on desktop */}
      <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-cockpit-bg via-cockpit-bg/80 to-cockpit-bg/20" />

      <div className="w-full max-w-sm relative z-10 px-4 lg:mr-24">
        <div className="text-center mb-8">
          <img
            src="/ark-icon.jpg"
            alt="NoahsArk"
            className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg shadow-cockpit-accent/20"
          />
          <h1 className="text-2xl font-bold text-cockpit-text">Cockpit</h1>
          <p className="text-cockpit-text-muted text-sm mt-1">NoahsArk Command Center</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-cockpit-surface/90 backdrop-blur-sm border border-cockpit-border rounded-2xl p-6 space-y-4 shadow-xl">
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
              className="w-full bg-cockpit-bg/80 border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5 text-cockpit-text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-cockpit-bg/80 border border-cockpit-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover text-cockpit-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-cockpit-text-muted/50 mt-6">Weathering every storm</p>
      </div>
    </div>
  );
}
