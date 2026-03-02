import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./Layout";
import { HomelabPage } from "./pages/Homelab";
import { BookmarksPage } from "./pages/Bookmarks";
import { DedupPage } from "./pages/Dedup";
import { RandomizerPage } from "./pages/Randomizer";
import { MarkdownPage } from "./pages/Markdown";
import { GraphPage } from "./pages/Graph";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/homelab" replace />} />
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
  </React.StrictMode>
);
