import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Plus, Save, ArrowLeft, Search, Wifi, WifiOff, Pencil, Check, Trash2, Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Code, Link, Quote, Minus, Strikethrough, Table, Image, CheckSquare, WrapText, Undo2, Redo2, Eye, EyeOff } from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

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
  const [wsConnected, setWsConnected] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRemoteUpdate = useRef(false);

  function pushUndo(text: string) {
    setUndoStack((prev) => [...prev.slice(-50), text]);
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, content]);
    handleContentChange(prev);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, content]);
    handleContentChange(next);
  }

  function insertMarkdown(before: string, after: string = "") {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    pushUndo(content);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);
    handleContentChange(newContent);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    }, 0);
  }

  function insertLinePrefix(prefix: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    pushUndo(content);
    const newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
    handleContentChange(newContent);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
  }

  function insertBlock(block: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    pushUndo(content);
    const before = content.substring(0, start);
    const after = content.substring(start);
    const prefix = before.endsWith("\n") || before === "" ? "" : "\n";
    const suffix = after.startsWith("\n") || after === "" ? "" : "\n";
    const newContent = before + prefix + block + suffix + after;
    handleContentChange(newContent);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + prefix.length + block.length;
    }, 0);
  }

  function insertTable() {
    insertBlock("| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |");
  }

  const currentDoc = docs.find((d) => d.id === id);

  async function loadDocs() {
    setError("");
    try {
      const data = await api<{ docs: DocMeta[] }>("/markdown/docs");
      setDocs(data.docs || []);
    } catch {
      setError("Failed to load documents");
    }
  }

  async function loadDoc(docId: string) {
    const data = await api<{ id: string; content: string; title: string }>(`/markdown/docs/${docId}`);
    setContent(data.content);
    setUndoStack([]);
    setRedoStack([]);
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

  async function renameDoc() {
    if (!id || !titleInput.trim()) return;
    let newContent = content;
    if (content.startsWith("# ")) {
      newContent = `# ${titleInput.trim()}\n${content.split("\n").slice(1).join("\n")}`;
    } else {
      newContent = `# ${titleInput.trim()}\n\n${content}`;
    }
    setContent(newContent);
    setEditingTitle(false);
    await api(`/markdown/docs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content: newContent }),
    });
    loadDocs();
  }

  async function deleteDoc(docId: string) {
    await api(`/markdown/docs/${docId}`, { method: "DELETE" });
    loadDocs();
    if (docId === id) navigate("/markdown");
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

  useEffect(() => { loadDocs(); }, []);
  useEffect(() => { if (id) loadDoc(id); }, [id]);

  // WebSocket for real-time collaboration
  useEffect(() => {
    if (!id) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws?docId=${id}`);
    wsRef.current = ws;
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "update" && data.docId === id) {
          isRemoteUpdate.current = true;
          setContent(data.content);
        }
      } catch {}
    };
    return () => { ws.close(); setWsConnected(false); };
  }, [id]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (!isRemoteUpdate.current && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ docId: id, content: newContent }));
    }
    isRemoteUpdate.current = false;
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); saveDoc(); return; }
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      // Only process formatting shortcuts when textarea is focused
      if (document.activeElement !== textareaRef.current) return;
      if (e.ctrlKey && e.key === "b") { e.preventDefault(); insertMarkdown("**", "**"); return; }
      if (e.ctrlKey && e.key === "i") { e.preventDefault(); insertMarkdown("*", "*"); return; }
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); insertMarkdown("[", "](url)"); return; }
      if (e.ctrlKey && e.key === "`") { e.preventDefault(); insertMarkdown("`", "`"); return; }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [id, content, undoStack, redoStack]);

  // Handle Tab for indentation and Enter for auto-list continuation
  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = textareaRef.current;
    if (!ta) return;

    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      pushUndo(content);
      if (e.shiftKey) {
        // Outdent: remove 2 spaces from line start
        const lineStart = content.lastIndexOf("\n", start - 1) + 1;
        if (content.substring(lineStart, lineStart + 2) === "  ") {
          const newContent = content.substring(0, lineStart) + content.substring(lineStart + 2);
          handleContentChange(newContent);
          setTimeout(() => { ta.selectionStart = Math.max(lineStart, start - 2); ta.selectionEnd = Math.max(lineStart, end - 2); }, 0);
        }
      } else {
        // Indent: add 2 spaces
        const newContent = content.substring(0, start) + "  " + content.substring(end);
        handleContentChange(newContent);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
      }
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      const start = ta.selectionStart;
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      const currentLine = content.substring(lineStart, start);

      // Auto-continue bullet lists
      const bulletMatch = currentLine.match(/^(\s*)([-*+])\s/);
      if (bulletMatch) {
        // If line is just the bullet (empty item), remove it
        if (currentLine.trim() === bulletMatch[2]) {
          e.preventDefault();
          pushUndo(content);
          const newContent = content.substring(0, lineStart) + "\n" + content.substring(start);
          handleContentChange(newContent);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; }, 0);
          return;
        }
        e.preventDefault();
        pushUndo(content);
        const prefix = `\n${bulletMatch[1]}${bulletMatch[2]} `;
        const newContent = content.substring(0, start) + prefix + content.substring(start);
        handleContentChange(newContent);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
        return;
      }

      // Auto-continue numbered lists
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
      if (numMatch) {
        if (currentLine.trim() === `${numMatch[2]}.`) {
          e.preventDefault();
          pushUndo(content);
          const newContent = content.substring(0, lineStart) + "\n" + content.substring(start);
          handleContentChange(newContent);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; }, 0);
          return;
        }
        e.preventDefault();
        pushUndo(content);
        const nextNum = parseInt(numMatch[2]) + 1;
        const prefix = `\n${numMatch[1]}${nextNum}. `;
        const newContent = content.substring(0, start) + prefix + content.substring(start);
        handleContentChange(newContent);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
        return;
      }

      // Auto-continue task lists
      const taskMatch = currentLine.match(/^(\s*)([-*+])\s\[[ x]\]\s/);
      if (taskMatch) {
        if (currentLine.trim().match(/^[-*+]\s\[[ x]\]$/)) {
          e.preventDefault();
          pushUndo(content);
          const newContent = content.substring(0, lineStart) + "\n" + content.substring(start);
          handleContentChange(newContent);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; }, 0);
          return;
        }
        e.preventDefault();
        pushUndo(content);
        const prefix = `\n${taskMatch[1]}${taskMatch[2]} [ ] `;
        const newContent = content.substring(0, start) + prefix + content.substring(start);
        handleContentChange(newContent);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
        return;
      }

      // Auto-continue blockquotes
      const quoteMatch = currentLine.match(/^(\s*>+)\s/);
      if (quoteMatch) {
        if (currentLine.trim().match(/^>+$/)) {
          e.preventDefault();
          pushUndo(content);
          const newContent = content.substring(0, lineStart) + "\n" + content.substring(start);
          handleContentChange(newContent);
          setTimeout(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; }, 0);
          return;
        }
        e.preventDefault();
        pushUndo(content);
        const prefix = `\n${quoteMatch[1]} `;
        const newContent = content.substring(0, start) + prefix + content.substring(start);
        handleContentChange(newContent);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + prefix.length; }, 0);
        return;
      }
    }
  }

  // Word and character count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (id) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/markdown")} className="flex items-center gap-2 text-sm text-cockpit-text-muted hover:text-cockpit-text transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            {editingTitle ? (
              <div className="flex items-center gap-2 min-w-0">
                <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && renameDoc()}
                  className="bg-cockpit-bg border border-cockpit-border rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-cockpit-accent min-w-0"
                  autoFocus />
                <button onClick={renameDoc} className="text-cockpit-accent shrink-0"><Check className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingTitle(true); setTitleInput(currentDoc?.title || ""); }}
                className="flex items-center gap-1.5 text-sm text-cockpit-text-muted hover:text-cockpit-text truncate">
                <Pencil className="w-3 h-3 shrink-0" /> <span className="truncate">{currentDoc?.title || id}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-cockpit-text-muted hidden sm:inline">{wordCount} words &middot; {charCount} chars</span>
            <button onClick={saveDoc} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors">
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"} <kbd className="text-xs opacity-60 ml-1 hidden sm:inline">Ctrl+S</kbd>
            </button>
            {wsConnected ? (
              <span className="flex items-center gap-1 text-xs text-cockpit-success"><Wifi className="w-3 h-3" /> Live</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-cockpit-text-muted"><WifiOff className="w-3 h-3" /> Offline</span>
            )}
          </div>
        </div>

        {/* Split Editor */}
        <div className={`grid gap-4 h-[calc(100vh-12rem)] ${previewOnly ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
          {!previewOnly && (
            <div className="flex flex-col min-h-0">
              {/* Markdown Toolbar */}
              <div className="flex items-center gap-0.5 bg-cockpit-surface border border-cockpit-border border-b-0 rounded-t-xl px-2 py-1.5 overflow-x-auto">
                {[
                  { icon: Bold, action: () => insertMarkdown("**", "**"), title: "Bold (Ctrl+B)" },
                  { icon: Italic, action: () => insertMarkdown("*", "*"), title: "Italic (Ctrl+I)" },
                  { icon: Strikethrough, action: () => insertMarkdown("~~", "~~"), title: "Strikethrough" },
                  null,
                  { icon: Heading1, action: () => insertLinePrefix("# "), title: "Heading 1" },
                  { icon: Heading2, action: () => insertLinePrefix("## "), title: "Heading 2" },
                  { icon: Heading3, action: () => insertLinePrefix("### "), title: "Heading 3" },
                  null,
                  { icon: List, action: () => insertLinePrefix("- "), title: "Bullet List" },
                  { icon: ListOrdered, action: () => insertLinePrefix("1. "), title: "Numbered List" },
                  { icon: CheckSquare, action: () => insertLinePrefix("- [ ] "), title: "Task List" },
                  { icon: Quote, action: () => insertLinePrefix("> "), title: "Blockquote" },
                  null,
                  { icon: Code, action: () => insertMarkdown("`", "`"), title: "Inline Code (Ctrl+`)" },
                  { icon: WrapText, action: () => insertBlock("```\n\n```"), title: "Code Block" },
                  { icon: Minus, action: () => insertBlock("---"), title: "Horizontal Rule" },
                  null,
                  { icon: Link, action: () => insertMarkdown("[", "](url)"), title: "Link (Ctrl+K)" },
                  { icon: Image, action: () => insertMarkdown("![alt](", ")"), title: "Image" },
                  { icon: Table, action: insertTable, title: "Table" },
                  null,
                  { icon: Undo2, action: undo, title: "Undo (Ctrl+Z)" },
                  { icon: Redo2, action: redo, title: "Redo (Ctrl+Y)" },
                  null,
                  { icon: previewOnly ? EyeOff : Eye, action: () => setPreviewOnly(!previewOnly), title: previewOnly ? "Show Editor" : "Preview Only" },
                ].map((item, i) =>
                  item === null ? (
                    <div key={`sep-${i}`} className="w-px h-5 bg-cockpit-border mx-0.5 shrink-0" />
                  ) : (
                    <button key={item.title} onClick={item.action} title={item.title}
                      className="p-1.5 rounded text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5 transition-colors shrink-0">
                      <item.icon className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => { pushUndo(content); handleContentChange(e.target.value); }}
                onKeyDown={handleTextareaKeyDown}
                className="flex-1 bg-cockpit-surface border border-cockpit-border rounded-b-xl p-4 text-sm font-mono resize-none focus:outline-none focus:border-cockpit-accent leading-relaxed"
                spellCheck={false}
                placeholder="Start writing markdown here..."
              />
              {/* Status bar */}
              <div className="flex items-center justify-between text-xs text-cockpit-text-muted mt-1 px-1 sm:hidden">
                <span>{wordCount} words &middot; {charCount} chars</span>
              </div>
            </div>
          )}
          <div className="bg-cockpit-surface border border-cockpit-border rounded-xl overflow-y-auto prose prose-invert prose-sm max-w-none min-h-0 relative">
            {previewOnly && (
              <button
                onClick={() => setPreviewOnly(false)}
                className="sticky top-0 z-10 w-full flex items-center justify-center gap-2 px-3 py-2 bg-cockpit-bg/90 border-b border-cockpit-border text-xs text-cockpit-text-muted hover:text-cockpit-text transition-colors backdrop-blur-sm"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Only — click to show editor
              </button>
            )}
            <div className="p-4 sm:p-6">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Document list mode
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-6 h-6 text-cockpit-accent" />
            Markdown Editor
          </h2>
          <p className="text-cockpit-text-muted mt-1">Write and preview markdown documents</p>
          <ErrorBanner message={error} onRetry={loadDocs} />
        </div>
        <button onClick={createDoc} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-cockpit-accent hover:bg-cockpit-accent-hover rounded-lg text-sm font-medium transition-colors w-full sm:w-auto">
          <Plus className="w-4 h-4" /> New Document
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cockpit-text-muted" />
        <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-md bg-cockpit-surface border border-cockpit-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cockpit-accent" />
      </div>

      {/* Document List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase())).map((doc) => (
          <div key={doc.id} className="bg-cockpit-surface border border-cockpit-border rounded-xl p-5 hover:border-cockpit-accent/30 transition-colors group relative">
            <button onClick={() => navigate(`/markdown/${doc.id}`)} className="text-left w-full">
              <div className="font-medium">{doc.title}</div>
              <div className="flex items-center gap-3 text-xs text-cockpit-text-muted mt-2">
                <span>{doc.word_count} words</span>
                <span>&middot;</span>
                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              </div>
            </button>
            <button onClick={() => deleteDoc(doc.id)}
              className="absolute top-3 right-3 text-cockpit-text-muted hover:text-cockpit-danger opacity-0 group-hover:opacity-100 transition-opacity p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
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
