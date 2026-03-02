import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./Layout";
import { LoginPage } from "./pages/Login";
import { HomelabPage } from "./pages/Homelab";
import { BookmarksPage } from "./pages/Bookmarks";
import { DedupPage } from "./pages/Dedup";
import { RandomizerPage } from "./pages/Randomizer";
import { MarkdownPage } from "./pages/Markdown";
import { GraphPage } from "./pages/Graph";
import { DashboardPage } from "./pages/Dashboard";
import "./index.css";

function App() {
  const [auth, setAuth] = useState<boolean | null>(null);

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      setAuth(res.ok);
    } catch {
      setAuth(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  if (auth === null) {
    return (
      <div className="min-h-screen bg-cockpit-bg flex items-center justify-center">
        <div className="text-cockpit-text-muted">Loading...</div>
      </div>
    );
  }

  if (!auth) {
    return <LoginPage onLogin={() => setAuth(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout onLogout={() => setAuth(false)} />}>
          <Route index element={<DashboardPage />} />
          <Route path="/homelab" element={<HomelabPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/dedup" element={<DedupPage />} />
          <Route path="/randomizer" element={<RandomizerPage />} />
          <Route path="/markdown" element={<MarkdownPage />} />
          <Route path="/markdown/:id" element={<MarkdownPage />} />
          <Route path="/graph" element={<GraphPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
