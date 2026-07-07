'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle } from 'lucide-react';
import { NODE_META } from '@/lib/centralized/apoyo';
import type { GraphNode, GraphEdge } from '@/lib/centralized/apoyo';

// react-force-graph usa d3-force (física) + canvas (render), como el grafo de Obsidian.
// Tamaño base por tipo (además del extra por nº de conexiones). Situación es el ancla
// (más grande); causa la más pequeña (raíz).
const NODE_R: Record<string, number> = { situation: 9, problem: 7, cause: 4.5, solution: 6.5 };
const BG = '#000000';

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Traza la FORMA del nodo según su tipo (distinción clara además del color):
//  situación = hexágono · problema = triángulo · causa = círculo · solución = cuadrado redondeado.
function traceShape(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, r: number) {
  ctx.beginPath();
  if (type === 'situation') {
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * (Math.PI / 3); const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  } else if (type === 'problem') {
    const h = r * 1.16;
    ctx.moveTo(x, y - h); ctx.lineTo(x + h * 0.92, y + h * 0.62); ctx.lineTo(x - h * 0.92, y + h * 0.62); ctx.closePath();
  } else if (type === 'solution') {
    const s = r * 0.92; roundRectPath(ctx, x - s, y - s, 2 * s, 2 * s, r * 0.34);
  } else {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  }
}

const linkId = (l: any, end: 'source' | 'target') => (typeof l[end] === 'object' ? l[end].id : l[end]);

const hexToRgb = (h: string) => { const s = h.replace('#', ''); return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) }; };
const hexA = (h: string, a: number) => { const { r, g, b } = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (h1: string, h2: string, t: number) => { const a = hexToRgb(h1), b = hexToRgb(h2); return `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`; };

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number, h: number) => setSize({ width: Math.max(320, Math.floor(w)), height: Math.max(300, Math.floor(h)) });
    const ro = new ResizeObserver((e) => apply(e[0].contentRect.width, e[0].contentRect.height));
    ro.observe(el);
    apply(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

export default function KnowledgeGraph({
  nodes,
  edges,
  selectedKey,
  onSelect,
  fitSignal = '',
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey: string | null;
  onSelect: (n: GraphNode | null) => void;
  /** Cambia solo cuando debe reencuadrarse (p. ej. al cambiar de usuario). NO cambia al crear nodos. */
  fitSignal?: string;
}) {
  const fgRef = useRef<any>(null);
  const fittedRef = useRef<string | null>(null);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);
  useEffect(() => { let ok = true; import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); }); return () => { ok = false; }; }, []);

  // Reusa los MISMOS objetos-nodo entre renders (por key) para que react-force-graph
  // conserve sus posiciones (x/y) y NO reinicie el layout al cambiar solo las aristas.
  const nodeObjRef = useRef<Map<string, any>>(new Map());
  const graphData = useMemo(() => {
    const cache = nodeObjRef.current;
    const keep = new Set<string>();
    const gnodes = nodes.map((n) => {
      keep.add(n.key);
      let o = cache.get(n.key);
      if (!o) { o = { id: n.key }; cache.set(n.key, o); }
      o.ref = n;
      return o;
    });
    for (const k of Array.from(cache.keys())) if (!keep.has(k)) cache.delete(k);
    return { nodes: gnodes, links: edges.map((e) => ({ source: e.source, target: e.target, type: e.type })) };
  }, [nodes, edges]);


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

  // Ajusta fuerzas y reencuadra SOLO cuando cambia `fitSignal` (p. ej. otro usuario).
  // Al crear nodos, `fitSignal` no cambia → la cámara se queda donde está.
  useEffect(() => {
    const t = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force('charge')?.strength(-160);
      fg.d3Force('link')?.distance(60).strength(0.9);
      if (fittedRef.current !== fitSignal) { fittedRef.current = fitSignal; fg.zoomToFit?.(500, 70); }
    }, 400);
    return () => clearTimeout(t);
  }, [fitSignal, ForceGraph2D]);

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
      <div ref={ref} style={{ background: BG }} className="w-full h-full flex items-center justify-center">
        <p className="text-[13px]" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>Sin situaciones aún. Crea la primera para empezar el grafo.</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ background: BG }} className="relative w-full h-full overflow-hidden">
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
            // Los primeros frames pueden no tener posición aún (NaN) → evita que
            // createRadialGradient lance por valores no finitos.
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const n: GraphNode = node.ref;
            const color = NODE_META[n.type].color;
            const r = radiusOf(n);
            if (!Number.isFinite(r) || r <= 0) return;
            const lit = isLit(node.id);
            const isActive = node.id === active;
            const isSel = node.id === selectedKey;
            const alpha = lit ? 1 : 0.2;

            // Halo de luz (círculo suave alrededor de la forma) — aspecto luminoso.
            const glowR = r * (isActive ? 3.2 : 2.4);
            const glow = ctx.createRadialGradient(node.x, node.y, r * 0.2, node.x, node.y, glowR);
            glow.addColorStop(0, hexA(color, lit ? (isActive ? 0.5 : 0.34) : 0.08));
            glow.addColorStop(1, hexA(color, 0));
            ctx.globalAlpha = 1;
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI); ctx.fill();

            // Anillo del seleccionado (misma forma que el nodo)
            if (isSel) {
              ctx.globalAlpha = lit ? 0.7 : 0.22;
              traceShape(ctx, n.type, node.x, node.y, r + 3.4);
              ctx.strokeStyle = hexA(color, 0.9); ctx.lineWidth = 1.4; ctx.stroke();
            }

            // Forma del tipo, color saturado con leve oscurecido al borde (sin núcleo blanco).
            const rr = isActive ? r + 1 : r;
            const g = ctx.createRadialGradient(node.x, node.y, rr * 0.25, node.x, node.y, rr * 1.05);
            g.addColorStop(0, color);
            g.addColorStop(1, mix(color, '#000000', 0.3));
            traceShape(ctx, n.type, node.x, node.y, rr);
            ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fill();
            ctx.globalAlpha = alpha * 0.85; ctx.lineWidth = 0.9; ctx.strokeStyle = mix(color, '#000000', 0.45); ctx.stroke();
            ctx.globalAlpha = alpha;

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
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const n: GraphNode = node.ref;
            ctx.fillStyle = colorStr;
            traceShape(ctx, n.type, node.x, node.y, radiusOf(n) + 3); ctx.fill();
          }}
        />
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
