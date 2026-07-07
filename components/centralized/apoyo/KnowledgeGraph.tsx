'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle } from 'lucide-react';
import { NODE_META } from '@/lib/centralized/apoyo';
import type { GraphNode, GraphEdge } from '@/lib/centralized/apoyo';

// react-force-graph usa d3-force (física) + canvas (render), como el grafo de Obsidian.
const NODE_R: Record<string, number> = { situation: 7, problem: 5.5, cause: 4.5, solution: 5.5 };
const BG = '#0e0f1a';

const linkId = (l: any, end: 'source' | 'target') => (typeof l[end] === 'object' ? l[end].id : l[end]);

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(320, Math.floor(e[0].contentRect.width))));
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
  height = 580,
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

  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);
  useEffect(() => { let ok = true; import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); }); return () => { ok = false; }; }, []);

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

  const degree = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) { m.set(e.source, (m.get(e.source) || 0) + 1); m.set(e.target, (m.get(e.target) || 0) + 1); }
    return m;
  }, [edges]);
  const radiusOf = (n: GraphNode) => NODE_R[n.type] + Math.min(4.5, Math.sqrt(degree.get(n.key) || 0) * 1.25);

  const active = hoverKey || selectedKey;
  const isLit = (key: string) => !active || key === active || !!neighbors.get(active)?.has(key);
  const linkActive = (l: any) => !!active && (linkId(l, 'source') === active || linkId(l, 'target') === active);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-160);
    fg.d3Force('link')?.distance(60).strength(0.9);
    const t = setTimeout(() => fg.zoomToFit?.(500, 70), 500);
    return () => clearTimeout(t);
  }, [graphData, ForceGraph2D]);

  const zoomBy = (f: number) => { const fg = fgRef.current; if (fg) fg.zoom(fg.zoom() * f, 250); };
  const fit = () => fgRef.current?.zoomToFit(400, 70);
  const reheat = () => fgRef.current?.d3ReheatSimulation();

  const Ctrl = ({ onClick, title, children }: any) => (
    <button onClick={onClick} title={title} className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-white/80 hover:text-white transition-colors backdrop-blur-sm">
      {children}
    </button>
  );

  if (nodes.length === 0) {
    return (
      <div ref={ref} style={{ height, background: BG }} className="flex items-center justify-center rounded-b-lg">
        <p className="text-[13px]" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>Sin situaciones aún. Crea la primera para empezar el grafo.</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ height, background: BG }} className="relative rounded-b-lg overflow-hidden">
      {/* Controles */}
      {ForceGraph2D && (
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
          <Ctrl onClick={fit} title="Ajustar"><Maximize2 className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={() => zoomBy(1.4)} title="Acercar"><Plus className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={() => zoomBy(1 / 1.4)} title="Alejar"><Minus className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={reheat} title="Reorganizar"><Shuffle className="w-4 h-4" /></Ctrl>
        </div>
      )}

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
          cooldownTicks={140}
          warmupTicks={24}
          d3VelocityDecay={0.28}
          nodeRelSize={5}
          enableNodeDrag
          onBackgroundClick={() => onSelect(null)}
          onNodeHover={(n: any) => setHoverKey(n ? n.id : null)}
          onNodeClick={(n: any) => {
            if (!n) { onSelect(null); return; }
            onSelect(nodeByKey.get(n.id) || null);
            fgRef.current?.centerAt(n.x, n.y, 500);
          }}
          nodeLabel={(n: any) => {
            const nn: GraphNode = n.ref;
            const c = NODE_META[nn.type].color;
            return `<div style="max-width:240px;padding:8px 10px;background:#181826;border:1px solid #2b2b40;border-radius:8px;color:#e8e8f2;font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)">
              <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:${c};font-weight:700;margin-bottom:2px">${NODE_META[nn.type].label}</div>
              <div style="font-size:12.5px;font-weight:600;line-height:1.25">${escapeHtml(nn.title)}</div>
              ${nn.description ? `<div style="font-size:11px;color:#a9a9c2;margin-top:3px;line-height:1.3">${escapeHtml(nn.description)}</div>` : ''}
            </div>`;
          }}
          /* Fondo tipo nebulosa detrás del cúmulo */
          onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
            const ns = (graphData.nodes as any[]).filter((n) => typeof n.x === 'number');
            if (!ns.length) return;
            let cx = 0, cy = 0; for (const n of ns) { cx += n.x; cy += n.y; } cx /= ns.length; cy /= ns.length;
            let maxd = 80; for (const n of ns) maxd = Math.max(maxd, Math.hypot(n.x - cx, n.y - cy));
            const R = maxd * 1.5;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
            g.addColorStop(0, 'rgba(90,60,170,0.20)');
            g.addColorStop(0.55, 'rgba(45,32,80,0.09)');
            g.addColorStop(1, 'rgba(14,15,26,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fill();
          }}
          /* Aristas curvas + flechas + partículas al resaltar */
          linkCurvature={0.14}
          linkColor={(l: any) => (!active || linkActive(l) ? 'rgba(170,158,225,0.5)' : 'rgba(120,120,150,0.10)')}
          linkWidth={(l: any) => (linkActive(l) ? 1.8 : !active ? 1 : 0.5)}
          linkDirectionalArrowLength={(l: any) => (linkActive(l) ? 3.6 : 2.4)}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalArrowColor={() => 'rgba(200,192,240,0.7)'}
          linkDirectionalParticles={(l: any) => (linkActive(l) ? 3 : 0)}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleColor={(l: any) => NODE_META[(l.type as string).startsWith('solution') ? 'solution' : 'situation']?.color || '#c4b5fd'}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            const n: GraphNode = node.ref;
            const color = NODE_META[n.type].color;
            const r = radiusOf(n);
            const lit = isLit(node.id);
            const isActive = node.id === active;
            const isSel = node.id === selectedKey;

            ctx.globalAlpha = lit ? 1 : 0.2;

            if (isSel) {
              ctx.beginPath(); ctx.arc(node.x, node.y, r + 4.5, 0, 2 * Math.PI);
              ctx.strokeStyle = color; ctx.globalAlpha = lit ? 0.55 : 0.18; ctx.lineWidth = 1.6; ctx.stroke();
              ctx.globalAlpha = lit ? 1 : 0.2;
            }

            ctx.shadowColor = color; ctx.shadowBlur = isActive ? 20 : lit ? 10 : 0;
            ctx.beginPath(); ctx.arc(node.x, node.y, isActive ? r + 1.2 : r, 0, 2 * Math.PI);
            ctx.fillStyle = color; ctx.fill();
            // brillo interior
            ctx.shadowBlur = 0; ctx.globalAlpha = (lit ? 1 : 0.2) * 0.5;
            ctx.beginPath(); ctx.arc(node.x - r * 0.28, node.y - r * 0.28, r * 0.42, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
            ctx.globalAlpha = lit ? 1 : 0.2;

            const showLabel = scale >= 1.25 || (active ? lit : n.type === 'situation');
            if (showLabel) {
              const label = n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title;
              const fontSize = Math.max(3.2, 11 / scale);
              ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'top';
              ctx.globalAlpha = lit ? 1 : 0.28;
              ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
              ctx.fillStyle = isActive ? '#ffffff' : '#d8d9ec';
              ctx.fillText(label, node.x, node.y + r + 2.5);
              ctx.shadowBlur = 0;
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(node: any, colorStr: string, ctx: CanvasRenderingContext2D) => {
            const n: GraphNode = node.ref;
            ctx.fillStyle = colorStr; ctx.beginPath();
            ctx.arc(node.x, node.y, radiusOf(n) + 3, 0, 2 * Math.PI); ctx.fill();
          }}
        />
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
