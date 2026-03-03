import { useEffect, useState } from "react";
import { api } from "../api";
import { Bookmark, Search, Plus, X, Tag, ExternalLink, Pencil, Check, Download, Upload, AlertCircle, RefreshCw } from "lucide-react";

interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  tags: string[];
  createdAt: string;
}

export function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [error, setError] = useState("");

  const allTags = [...new Set(bookmarks.flatMap((b) => b.tags))].sort();

  async function load() {
    setError("");
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : "";
      const data = await api<any>(`/bookmarks${q}`);
      setBookmarks(data.bookmarks || []);
    } catch {
      setError("Failed to load bookmarks");
    }
  }

  async function addBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;
    setAdding(true);
    await api("/bookmarks", {
      method: "POST",
      body: JSON.stringify({ url: newUrl }),
    });
    setNewUrl("");
    setAdding(false);
    load();
  }

  async function deleteBookmark(id: string) {
    await api(`/bookmarks/${id}`, { method: "DELETE" });
    load();
  }

  async function saveEdit(id: string) {
    await api(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: editTitle,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setEditingId(null);
    load();
  }

  function startEdit(b: BookmarkItem) {
    setEditingId(b.id);
    setEditTitle(b.title);
    setEditTags(b.tags.join(", "));
  }

  useEffect(() => {
    load();
  }, [search]);

  const filtered = tagFilter
    ? bookmarks.filter((b) => b.tags.includes(tagFilter))
    : bookmarks;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Bookmark className="w-6 h-6 text-cockpit-accent" />
          Bookmarks
        </h2>
        <p className="text-cockpit-text-muted mt-1">Save, tag, and search your bookmarks</p>
      {error && (
        <div className="bg-cockpit-danger/10 border border-cockpit-danger/20 rounded-lg px-4 py-3 flex items-center justify-between mt-2">
          <span className="text-sm text-cockpit-danger flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={load} className="text-cockpit-danger hover:text-cockpit-danger/80 text-sm flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={async () => {
              const data = await api<any>("/bookmarks/export");
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "bookmarks.json"; a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cockpit-surface border border-cockpit-border text-xs text-cockpit-text-muted hover:text-cockpit-text transition-colors"
          >
            <Download className="w-3 h-3" /> Export
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cockpit-surface border border-cockpit-border text-xs text-cockpit-text-muted hover:text-cockpit-text transition-colors cursor-pointer">
            <Upload className="w-3 h-3" /> Import
            <input type="file" accept=".json" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const data = JSON.parse(text);
              await api("/bookmarks/import", { method: "POST", body: JSON.stringify(data) });
              load();
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {/* Add + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={addBookmark} className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
            <input
              type="url"
              placeholder="Paste a URL to save..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full bg-cockpit-surface border border-cockpit-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !newUrl}
            className="px-5 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {adding ? "Saving..." : "Save"}
          </button>
        </form>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cockpit-surface border border-cockpit-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
          />
        </div>
      </div>

      {/* Tag Filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTagFilter("")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              !tagFilter
                ? "bg-cockpit-accent text-white"
                : "bg-cockpit-surface border border-cockpit-border text-cockpit-text-muted hover:text-cockpit-text"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                tagFilter === tag
                  ? "bg-cockpit-accent text-white"
                  : "bg-cockpit-surface border border-cockpit-border text-cockpit-text-muted hover:text-cockpit-text"
              }`}
            >
              <Tag className="w-3 h-3" />
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Bookmark List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-12 text-center text-cockpit-text-muted">
            {search || tagFilter ? "No bookmarks match your filter" : "No bookmarks yet. Paste a URL above to get started!"}
          </div>
        ) : (
          filtered.map((b) => (
            <div
              key={b.id}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 hover:border-cockpit-accent/30 transition-colors group"
            >
              {editingId === b.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="Title"
                  />
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cockpit-accent"
                    placeholder="Tags (comma-separated)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(b.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cockpit-accent rounded-lg text-xs font-medium"
                    >
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-cockpit-text-muted text-xs hover:text-cockpit-text"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-cockpit-accent transition-colors flex items-center gap-2"
                    >
                      {b.title}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                    </a>
                    <div className="text-xs text-cockpit-text-muted mt-1 truncate">{b.url}</div>
                    {b.summary && (
                      <p className="text-sm text-cockpit-text-muted mt-2 line-clamp-2">{b.summary}</p>
                    )}
                    {b.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {b.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setTagFilter(tag)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cockpit-accent/10 text-cockpit-accent text-xs hover:bg-cockpit-accent/20 transition-colors"
                          >
                            <Tag className="w-3 h-3" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(b)}
                      className="text-cockpit-text-muted hover:text-cockpit-accent p-1"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteBookmark(b.id)}
                      className="text-cockpit-text-muted hover:text-cockpit-danger p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
