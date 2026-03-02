import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import ReactMarkdown from "react-markdown";
import { FileText, Plus, Save, ArrowLeft, Search } from "lucide-react";

interface DocMeta {
  id: string;
  title: string;
  word_count: number;
  created_at: string;
  updated_at: string;
  size: number;
}

export function MarkdownPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function loadDocs() {
    const data = await api<{ docs: DocMeta[] }>("/markdown/docs");
    setDocs(data.docs || []);
  }

  async function loadDoc(docId: string) {
    const data = await api<{ id: string; content: string }>(`/markdown/docs/${docId}`);
    setContent(data.content);
  }

  async function saveDoc() {
    if (!id) return;
    setSaving(true);
    await api(`/markdown/docs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    loadDocs();
  }

  async function createDoc() {
    const slug = `doc-${Date.now()}`;
    await api(`/markdown/docs/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ content: `# New Document\n\nStart writing here...` }),
    });
    loadDocs();
    navigate(`/markdown/${slug}`);
  }

  useEffect(() => {
    loadDocs();
  }, []);

  useEffect(() => {
    if (id) loadDoc(id);
  }, [id]);

  // Save on Ctrl+S
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveDoc();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [id, content]);

  if (id) {
    // Editor mode
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/markdown")}
            className="flex items-center gap-2 text-sm text-cockpit-text-muted hover:text-cockpit-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to documents
          </button>
          <button
            onClick={saveDoc}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
            <kbd className="text-xs opacity-60 ml-1">Ctrl+S</kbd>
          </button>
        </div>

        {/* Split Editor */}
        <div className="grid grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          {/* Editor */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-cockpit-accent"
            spellCheck={false}
          />
          {/* Preview */}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl p-6 overflow-y-auto prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  // Document list mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-6 h-6 text-cockpit-accent" />
            Markdown Editor
          </h2>
          <p className="text-cockpit-text-muted mt-1">Write and preview markdown documents</p>
        </div>
        <button
          onClick={createDoc}
          className="flex items-center gap-2 px-5 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-cockpit-surface border border-cockpit-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent"
        />
      </div>

      {/* Document List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs
          .filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()))
          .map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/markdown/${doc.id}`)}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 text-left hover:border-cockpit-accent/30 transition-colors"
            >
              <div className="font-medium">{doc.title}</div>
              <div className="flex items-center gap-3 text-xs text-cockpit-text-muted mt-2">
                <span>{doc.word_count} words</span>
                <span>&middot;</span>
                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        {docs.length === 0 && (
          <div className="col-span-full bg-cockpit-surface border border-cockpit-border rounded-xl p-12 text-center text-cockpit-text-muted">
            No documents yet. Click "New Document" to get started!
          </div>
        )}
      </div>
    </div>
  );
}
