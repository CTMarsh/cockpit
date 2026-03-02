import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Network, RefreshCw } from "lucide-react";

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
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null,
    offsetX: 0,
    offsetY: 0,
  });

  async function load() {
    const data = await api<any>("/graph/nodes");
    const loadedNodes = (data.nodes || []).map((n: GraphNode, i: number) => ({
      ...n,
      x: 400 + Math.cos((i / data.nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
      y: 300 + Math.sin((i / data.nodes.length) * Math.PI * 2) * 200 + Math.random() * 50,
      vx: 0,
      vy: 0,
    }));
    setNodes(loadedNodes);
    nodesRef.current = loadedNodes;
    setEdges(data.edges || []);
    edgesRef.current = data.edges || [];
    setSummary(data.summary);
  }

  // Simple force simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function tick() {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (!ctx || !canvas) return;

      // Force simulation
      for (const node of ns) {
        // Repulsion between all nodes
        for (const other of ns) {
          if (node.id === other.id) continue;
          const dx = node.x! - other.x!;
          const dy = node.y! - other.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          node.vx! += (dx / dist) * force;
          node.vy! += (dy / dist) * force;
        }

        // Center gravity
        node.vx! += (canvas.width / 2 - node.x!) * 0.01;
        node.vy! += (canvas.height / 2 - node.y!) * 0.01;
      }

      // Edge attraction
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

      // Apply velocities with damping
      for (const node of ns) {
        if (dragRef.current.node?.id === node.id) continue;
        node.vx! *= 0.9;
        node.vy! *= 0.9;
        node.x! += node.vx!;
        node.y! += node.vy!;
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Edges
      ctx.strokeStyle = "#1e1e2e";
      ctx.lineWidth = 1;
      for (const edge of es) {
        const source = ns.find((n) => n.id === edge.source);
        const target = ns.find((n) => n.id === edge.target);
        if (!source || !target) continue;
        ctx.beginPath();
        ctx.moveTo(source.x!, source.y!);
        ctx.lineTo(target.x!, target.y!);
        ctx.stroke();
      }

      // Nodes
      for (const node of ns) {
        const isHovered = hoveredNode?.id === node.id;
        const radius = isHovered ? 10 : 7;
        const color = node.type === "bookmark" ? "#3b82f6" : "#22c55e";

        ctx.beginPath();
        ctx.arc(node.x!, node.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (isHovered) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = "#e2e8f0";
        ctx.font = isHovered ? "bold 12px Inter, sans-serif" : "11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          node.label.length > 30 ? node.label.slice(0, 30) + "..." : node.label,
          node.x!,
          node.y! + radius + 16
        );
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, hoveredNode]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function findNode(x: number, y: number) {
      return nodesRef.current.find((n) => {
        const dx = n.x! - x;
        const dy = n.y! - y;
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (dragRef.current.node) {
        dragRef.current.node.x = x - dragRef.current.offsetX;
        dragRef.current.node.y = y - dragRef.current.offsetY;
        dragRef.current.node.vx = 0;
        dragRef.current.node.vy = 0;
        return;
      }

      const node = findNode(x, y);
      setHoveredNode(node || null);
      canvas!.style.cursor = node ? "pointer" : "default";
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const node = findNode(x, y);
      if (node) {
        dragRef.current = { node, offsetX: x - node.x!, offsetY: y - node.y! };
      }
    }

    function onMouseUp() {
      dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
    }

    function onClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      const node = findNode(e.clientX - rect.left, e.clientY - rect.top);
      if (node && !dragRef.current.node) {
        if (node.module === "bookmarks") {
          navigate("/bookmarks");
        } else if (node.module === "markdown") {
          navigate(`/markdown/${node.moduleId}`);
        }
      }
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Network className="w-6 h-6 text-cockpit-accent" />
            Knowledge Graph
          </h2>
          <p className="text-cockpit-text-muted mt-1">
            Visualize connections between your bookmarks and documents
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-cockpit-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#3b82f6]" /> Bookmarks ({summary.totalNodes})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" /> Documents
            </span>
            <span>{summary.totalEdges} connections</span>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cockpit-surface border border-cockpit-border hover:border-cockpit-accent/50 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-cockpit-surface border border-cockpit-border rounded-2xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={700}
          className="w-full"
        />
      </div>

      {summary.totalNodes === 0 && (
        <div className="text-center text-cockpit-text-muted text-sm">
          Add bookmarks and create documents to see them connected here
        </div>
      )}
    </div>
  );
}
