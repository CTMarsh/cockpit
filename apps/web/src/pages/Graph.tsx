import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Network, RefreshCw, ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  module: string;
  moduleId: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [summary, setSummary] = useState({ totalNodes: 0, totalEdges: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({ node: null, offsetX: 0, offsetY: 0 });
  // Zoom/pan state
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  async function load() {
    const data = await api<any>("/graph/nodes");
    const loadedNodes = (data.nodes || []).map((n: GraphNode, i: number) => ({
      ...n,
      x: 400 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
      y: 300 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
      vx: 0, vy: 0,
    }));
    setNodes(loadedNodes);
    nodesRef.current = loadedNodes;
    setEdges(data.edges || []);
    edgesRef.current = data.edges || [];
    setSummary(data.summary);
  }

  function screenToWorld(sx: number, sy: number) {
    const v = viewRef.current;
    return { x: (sx - v.panX) / v.zoom, y: (sy - v.panY) / v.zoom };
  }

  function zoom(delta: number) {
    const v = viewRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const oldZoom = v.zoom;
    v.zoom = Math.max(0.2, Math.min(5, v.zoom + delta));
    v.panX = cx - (cx - v.panX) * (v.zoom / oldZoom);
    v.panY = cy - (cy - v.panY) * (v.zoom / oldZoom);
  }

  function resetView() {
    viewRef.current = { zoom: 1, panX: 0, panY: 0 };
  }

  // Force simulation + rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function tick() {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      const v = viewRef.current;
      if (!ctx || !canvas) return;

      for (const node of ns) {
        for (const other of ns) {
          if (node.id === other.id) continue;
          const dx = node.x! - other.x!;
          const dy = node.y! - other.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          node.vx! += (dx / dist) * force;
          node.vy! += (dy / dist) * force;
        }
        node.vx! += (400 - node.x!) * 0.01;
        node.vy! += (300 - node.y!) * 0.01;
      }

      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x! - source.x!;
        const dy = target.y! - source.y!;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 150) * 0.005;
        source.vx! += (dx / dist) * force;
        source.vy! += (dy / dist) * force;
        target.vx! -= (dx / dist) * force;
        target.vy! -= (dy / dist) * force;
      }

      for (const node of ns) {
        if (dragRef.current.node?.id === node.id) continue;
        node.vx! *= 0.9;
        node.vy! *= 0.9;
        node.x! += node.vx!;
        node.y! += node.vy!;
      }

      // Draw with zoom/pan transform
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(v.panX, v.panY);
      ctx.scale(v.zoom, v.zoom);

      // Edges
      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        ctx.strokeStyle = "#2a2a3e";
        ctx.lineWidth = 1 / v.zoom;
        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(target.x!, target.y!);
        ctx.stroke();
        // Edge label at midpoint
        if (edge.label && v.zoom > 0.6) {
          ctx.fillStyle = "#475569";
          ctx.font = `${10 / v.zoom}px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(edge.label, (source.x! + target.x!) / 2, (source.y! + target.y!) / 2 - 5 / v.zoom);
        }
      }

      // Nodes
      const isSearching = searchTerm.length > 0;
      for (const node of ns) {
        const isHovered = hoveredNode?.id === node.id;
        const matchesSearch = isSearching && node.label.toLowerCase().includes(searchTerm.toLowerCase());
        const dimmed = isSearching && !matchesSearch;
        const radius = (isHovered ? 10 : 7) / (v.zoom > 1 ? 1 : v.zoom);

        const colors: Record<string, string> = { bookmark: "#d4a24e", document: "#5b9a6a", default: "#d4a24e" };
        const color = colors[node.type] || "#d4a24e";

        ctx.globalAlpha = dimmed ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isHovered || matchesSearch) {
          ctx.strokeStyle = "#e2d5b0";
          ctx.lineWidth = 2 / v.zoom;
          ctx.stroke();
        }

        ctx.fillStyle = dimmed ? "#475569" : "#e2d5b0";
        const fontSize = (isHovered ? 12 : 11) / (v.zoom > 1 ? 1 : v.zoom);
        ctx.font = `${isHovered ? "bold " : ""}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(
          node.label.length > 30 ? node.label.slice(0, 30) + "..." : node.label,
          node.x!, node.y! + radius + 16 / v.zoom
        );
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, hoveredNode, searchTerm]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function findNode(sx: number, sy: number) {
      const { x, y } = screenToWorld(sx, sy);
      return nodesRef.current.find((n) => {
        const dx = n.x! - x;
        const dy = n.y! - y;
        return Math.sqrt(dx * dx + dy * dy) < 15 / viewRef.current.zoom;
      });
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoom(e.deltaY > 0 ? -0.1 : 0.1);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (isPanningRef.current) {
        viewRef.current.panX += sx - lastPanRef.current.x;
        viewRef.current.panY += sy - lastPanRef.current.y;
        lastPanRef.current = { x: sx, y: sy };
        return;
      }

      if (dragRef.current.node) {
        const { x, y } = screenToWorld(sx, sy);
        dragRef.current.node.x = x - dragRef.current.offsetX;
        dragRef.current.node.y = y - dragRef.current.offsetY;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
        return;
      }

      const node = findNode(sx, sy);
      setHoveredNode(node || null);
      canvas!.style.cursor = node ? "pointer" : "default";
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const node = findNode(sx, sy);
      if (node) {
        const { x, y } = screenToWorld(sx, sy);
        dragRef.current = { node, offsetX: x - node.x!, offsetY: y - node.y! };
      } else {
        isPanningRef.current = true;
        lastPanRef.current = { x: sx, y: sy };
        canvas!.style.cursor = "grabbing";
      }
    }

    function onMouseUp() {
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
      isPanningRef.current = false;
      canvas!.style.cursor = "default";
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const node = findNode(e.clientX - rect.left, e.clientY - rect.top);
      if (node && !dragRef.current.node) {
        if (node.module === "bookmarks") navigate("/bookmarks");
        else if (node.module === "markdown") navigate(`/markdown/${node.moduleId}`);
      }
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Network className="w-6 h-6 text-cockpit-accent" /> Knowledge Graph
          </h2>
          <p className="text-cockpit-text-muted mt-1">Visualize connections between your bookmarks and documents</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            type="text" placeholder="Search nodes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cockpit-surface border border-cockpit-border rounded-lg px-3 py-1.5 text-sm w-full sm:w-48 focus:outline-none focus:border-cockpit-accent"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm text-cockpit-text-muted">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cockpit-accent" /> Bookmarks ({summary.totalNodes})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cockpit-success" /> Documents</span>
            <span>{summary.totalEdges} connections</span>
          </div>
          <button onClick={load} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm w-full sm:w-auto">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="relative bg-cockpit-surface border border-cockpit-border rounded-2xl overflow-hidden">
        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
          <button onClick={() => zoom(0.2)} className="p-1.5 bg-cockpit-bg/80 border border-cockpit-border rounded-lg text-cockpit-text-muted hover:text-cockpit-text">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => zoom(-0.2)} className="p-1.5 bg-cockpit-bg/80 border border-cockpit-border rounded-lg text-cockpit-text-muted hover:text-cockpit-text">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetView} className="p-1.5 bg-cockpit-bg/80 border border-cockpit-border rounded-lg text-cockpit-text-muted hover:text-cockpit-text">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
        <canvas ref={canvasRef} width={1200} height={700} className="w-full" />
      </div>

      {summary.totalNodes === 0 && (
        <div className="text-center text-cockpit-text-muted text-sm">
          Add bookmarks and create documents to see them connected here
        </div>
      )}
    </div>
  );
}
