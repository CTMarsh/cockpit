import { useEffect, useState } from "react";
import { api } from "../api";
import { Shuffle, Sparkles, Clock, BarChart3 } from "lucide-react";

interface ProjectIdea {
  id: number;
  title: string;
  description: string;
  stack: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  estimatedHours: string;
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

  async function loadFilters() {
    const data = await api<Filters>("/randomizer/filters");
    setFilters(data);
  }

  async function generate() {
    setSpinning(true);
    const params = new URLSearchParams();
    if (stack) params.set("stack", stack);
    if (difficulty) params.set("difficulty", difficulty);
    if (category) params.set("category", category);
    const q = params.toString() ? `?${params}` : "";
    try {
      const data = await api<ProjectIdea>(`/randomizer/random${q}`);
      setIdea(data);
    } catch {
      // No matches
    }
    setSpinning(false);
  }

  useEffect(() => {
    loadFilters();
    generate();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Shuffle className="w-6 h-6 text-cockpit-accent" />
          What Should I Build?
        </h2>
        <p className="text-cockpit-text-muted mt-1">Get inspired with random project ideas</p>
      </div>

      {/* Filters */}
      {filters && (
        <div className="flex gap-3 flex-wrap">
          <select
            value={stack}
            onChange={(e) => setStack(e.target.value)}
            className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          >
            <option value="">Any Stack</option>
            {filters.stacks.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          >
            <option value="">Any Difficulty</option>
            {filters.difficulties.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-cockpit-surface border border-cockpit-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
          >
            <option value="">Any Category</option>
            {filters.categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={spinning}
            className="px-6 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
            Generate
          </button>
        </div>
      )}

      {/* Idea Card */}
      {idea && (
        <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl p-8 max-w-2xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h3 className="text-xl font-bold">{idea.title}</h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[idea.difficulty]}`}
            >
              {idea.difficulty}
            </span>
          </div>
          <p className="text-cockpit-text-muted leading-relaxed">{idea.description}</p>
          <div className="flex items-center gap-4 mt-6 text-sm text-cockpit-text-muted">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              {idea.category}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              ~{idea.estimatedHours}h
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {idea.stack.map((s) => (
              <span
                key={s}
                className="px-3 py-1 rounded-lg bg-cockpit-accent/10 text-cockpit-accent text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
