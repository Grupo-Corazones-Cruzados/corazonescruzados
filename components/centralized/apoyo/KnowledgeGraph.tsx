'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NODE_META } from '@/lib/centralized/apoyo';
import type { GraphNode, GraphEdge } from '@/lib/centralized/apoyo';

// react-force-graph usa d3-force (física) + canvas (render), como el grafo de Obsidian.

const NODE_R: Record<string, number> = { situation: 7, problem: 5.5, cause: 4.5, solution: 5.5 };
const BG = '#0e0f1a';

/** Mide el ancho del contenedor (react-force-graph necesita width/height explícitos). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.max(320, Math.floor(entries[0].contentRect.width))));
    ro.observe(el);
    setW(Math.max(320, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return { ref, width: w };
}

export default function KnowledgeGraph({
  nodes,
  edges,
  selectedKey,
  onSelect,
  height = 560,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey: string | null;
  onSelect: (n: GraphNode | null) => void;
  height?: number;
}) {
  const fgRef = useRef<any>(null);
  const { ref, width } = useSize<HTMLDivElement>();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  // Carga la librería solo en cliente (usa window/canvas) y renderiza el componente
  // real (así el `ref` funciona; `next/dynamic` no reenvía refs).
  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);
  useEffect(() => { let ok = true; import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); }); return () => { ok = false; }; }, []);

  // Datos en el formato de la librería (memoizado: no reinicia la física en cada hover).
  const graphData = useMemo(() => ({
    nodes: nodes.map((n) => ({ id: n.key, ref: n })),
    links: edges.map((e) => ({ source: e.source, target: e.target, type: e.type })),
  }), [nodes, edges]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const active = hoverKey || selectedKey;
  const isLit = (key: string) => !active || key === active || !!neighbors.get(active)?.has(key);

  // Ajusta fuerzas (repulsión + distancia) y encuadra al cargar.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-150);
    fg.d3Force('link')?.distance(56).strength(0.9);
    const t = setTimeout(() => fg.zoomToFit?.(400, 60), 500);
    return () => clearTimeout(t);
  }, [graphData, ForceGraph2D]);

  if (nodes.length === 0) {
    return (
      <div ref={ref} style={{ height, background: BG }} className="flex items-center justify-center rounded-b-lg">
        <p className="text-[13px]" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>Sin situaciones aún. Crea la primera para empezar el grafo.</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ height, background: BG }} className="rounded-b-lg overflow-hidden">
      {!ForceGraph2D ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[12px] animate-pulse" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>Cargando grafo…</span>
        </div>
      ) : (
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData as any}
        backgroundColor={BG}
        cooldownTicks={120}
        d3VelocityDecay={0.3}
        nodeRelSize={5}
        enableNodeDrag
        onBackgroundClick={() => onSelect(null)}
        onNodeHover={(n: any) => setHoverKey(n ? n.id : null)}
        onNodeClick={(n: any) => onSelect(n ? nodeByKey.get(n.id) || null : null)}
        linkColor={(l: any) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          const lit = !active || s === active || t === active;
          return lit ? 'rgba(160,150,220,0.55)' : 'rgba(120,120,150,0.12)';
        }}
        linkWidth={(l: any) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return !active || s === active || t === active ? 1.4 : 0.6;
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const n: GraphNode = node.ref;
          const color = NODE_META[n.type].color;
          const r = NODE_R[n.type];
          const lit = isLit(node.id);
          const isActive = node.id === active;
          const isSel = node.id === selectedKey;

          ctx.globalAlpha = lit ? 1 : 0.22;

          // Halo del seleccionado
          if (isSel) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
            ctx.strokeStyle = color;
            ctx.globalAlpha = lit ? 0.5 : 0.18;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.globalAlpha = lit ? 1 : 0.22;
          }

          // Nodo con glow
          ctx.shadowColor = color;
          ctx.shadowBlur = isActive ? 16 : lit ? 8 : 0;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isActive ? r + 1 : r, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Etiqueta: al acercar el zoom, o si el nodo está resaltado.
          const showLabel = scale >= 1.3 || (active ? lit : n.type === 'situation');
          if (showLabel) {
            const label = n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title;
            const fontSize = Math.max(3.2, 11 / scale);
            ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.globalAlpha = lit ? 1 : 0.3;
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = isActive ? '#ffffff' : '#d8d9ec';
            ctx.fillText(label, node.x, node.y + r + 2);
            ctx.shadowBlur = 0;
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(node: any, colorStr: string, ctx: CanvasRenderingContext2D) => {
          const n: GraphNode = node.ref;
          ctx.fillStyle = colorStr;
          ctx.beginPath();
          ctx.arc(node.x, node.y, NODE_R[n.type] + 3, 0, 2 * Math.PI);
          ctx.fill();
        }}
      />
      )}
    </div>
  );
}
