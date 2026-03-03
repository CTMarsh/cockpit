import { useEffect, useState } from "react";
import { api } from "../api";
import { Shuffle, Sparkles, Clock, BarChart3, Heart, Copy, Check, Plus, Terminal, X, AlertCircle, RefreshCw } from "lucide-react";

interface ProjectIdea {
  id: number;
  title: string;
  description: string;
  stack: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimatedHours: string;
  prompt?: string;
  isCustom?: boolean;
}

interface Filters {
  stacks: string[];
  difficulties: string[];
  categories: string[];
}

const difficultyColors = {
  beginner: "bg-cockpit-success/10 text-cockpit-success",
  intermediate: "bg-cockpit-warning/10 text-cockpit-warning",
  advanced: "bg-cockpit-danger/10 text-cockpit-danger",
};

export function RandomizerPage() {
  const [idea, setIdea] = useState<ProjectIdea | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [stack, setStack] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [category, setCategory] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", description: "", stack: "", difficulty: "intermediate", category: "", estimatedHours: "4-8" });
  const [error, setError] = useState("");

  async function loadFilters() {
    setError("");
    try {
      const data = await api<Filters>("/randomizer/filters");
      setFilters(data);
    } catch {
      setError("Failed to load filters");
    }
  }

  async function loadFavorites() {
    const data = await api<{ favorites: number[] }>("/randomizer/favorites");
    setFavorites(data.favorites);
  }

  async function generate() {
    setSpinning(true);
    setShowPrompt(false);
    const params = new URLSearchParams();
    if (stack) params.set("stack", stack);
    if (difficulty) params.set("difficulty", difficulty);
    if (category) params.set("category", category);
    const q = params.toString() ? `?${params}` : "";
    try {
      const data = await api<ProjectIdea>(`/randomizer/random${q}`);
      setIdea(data);
    } catch {}
    setSpinning(false);
  }

  async function toggleFavorite(id: number) {
    if (favorites.includes(id)) {
      await api(`/randomizer/favorites/${id}`, { method: "DELETE" });
      setFavorites(favorites.filter((f) => f !== id));
    } else {
      await api(`/randomizer/favorites/${id}`, { method: "POST" });
      setFavorites([...favorites, id]);
    }
  }

  async function copyPrompt() {
    if (!idea?.prompt) return;
    await navigator.clipboard.writeText(idea.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addCustomIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.title) return;
    await api("/randomizer/ideas", {
      method: "POST",
      body: JSON.stringify({
        ...newIdea,
        stack: newIdea.stack.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setNewIdea({ title: "", description: "", stack: "", difficulty: "intermediate", category: "", estimatedHours: "4-8" });
    setShowAddForm(false);
    loadFilters();
  }

  useEffect(() => {
    loadFilters();
    loadFavorites();
    generate();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Shuffle className="w-6 h-6 text-cockpit-accent" />
            What Should I Build?
          </h2>
          <p className="text-cockpit-text-muted mt-1">Get inspired with random project ideas</p>
      {error && (
        <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-3 flex items-center justify-between mt-2">
          <span className="text-sm text-cockpit-danger flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={() => { loadFilters(); generate(); }} className="text-cockpit-danger hover:text-cockpit-danger/80 text-sm flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Idea
        </button>
      </div>

      {/* Add Custom Idea Form */}
      {showAddForm && (
        <form onSubmit={addCustomIdea} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newIdea.title} onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })} placeholder="Project title *"
              className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
            <input value={newIdea.stack} onChange={(e) => setNewIdea({ ...newIdea, stack: e.target.value })} placeholder="Stack (comma-separated)"
              className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
          </div>
          <textarea value={newIdea.description} onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })} placeholder="Description"
            className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent h-20 resize-none" />
          <div className="flex gap-3">
            <select value={newIdea.difficulty} onChange={(e) => setNewIdea({ ...newIdea, difficulty: e.target.value })}
              className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm">
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <input value={newIdea.category} onChange={(e) => setNewIdea({ ...newIdea, category: e.target.value })} placeholder="Category"
              className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent" />
            <button type="submit" className="px-5 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium">Save</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-cockpit-text-muted text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      {filters && (
        <div className="flex gap-3 flex-wrap">
          <select value={stack} onChange={(e) => setStack(e.target.value)} className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent">
            <option value="">Any Stack</option>
            {filters.stacks.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent">
            <option value="">Any Difficulty</option>
            {filters.difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent">
            <option value="">Any Category</option>
            {filters.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={generate} disabled={spinning}
            className="px-6 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} /> Generate
          </button>
        </div>
      )}

      {/* Idea Card */}
      {idea && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-5 sm:p-8 max-w-3xl w-full">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-xl font-bold">{idea.title}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(idea.id)}
                className={`p-1.5 rounded-lg transition-colors ${favorites.includes(idea.id) ? "text-red-400 bg-red-400/10" : "text-cockpit-text-muted hover:text-red-400"}`}
              >
                <Heart className={`w-4 h-4 ${favorites.includes(idea.id) ? "fill-current" : ""}`} />
              </button>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[idea.difficulty]}`}>
                {idea.difficulty}
              </span>
            </div>
          </div>
          <p className="text-cockpit-text-muted leading-relaxed">{idea.description}</p>
          <div className="flex items-center gap-4 mt-6 text-sm text-cockpit-text-muted">
            <div className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4" />{idea.category}</div>
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" />~{idea.estimatedHours}h</div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {idea.stack.map((s) => (
              <span key={s} className="px-3 py-1 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-xs font-medium">{s}</span>
            ))}
          </div>

          {/* AI Prompt Section */}
          <div className="mt-6 border-t border-cockpit-border pt-5">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-2 text-sm font-medium text-cockpit-accent hover:text-cockpit-accent-hover transition-colors"
            >
              <Terminal className="w-4 h-4" />
              {showPrompt ? "Hide" : "Show"} Claude Code Prompt
            </button>
            {showPrompt && idea.prompt && (
              <div className="mt-3 relative">
                <button
                  onClick={copyPrompt}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cockpit-bg/80 border border-cockpit-border text-xs text-cockpit-text-muted hover:text-cockpit-text transition-colors"
                >
                  {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
                <pre className="bg-cockpit-bg border border-cockpit-border rounded-xl p-4 text-sm text-cockpit-text-muted whitespace-pre-wrap font-mono overflow-x-auto max-h-96 overflow-y-auto">
                  {idea.prompt}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
