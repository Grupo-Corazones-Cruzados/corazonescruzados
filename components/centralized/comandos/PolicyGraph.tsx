'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle } from 'lucide-react';
import { POLICY_META, FUNCTION_TYPE_META } from '@/lib/centralized/comandos';
import type { PolicyGraphNode, PolicyGraphEdge } from '@/lib/centralized/comandos';

// Mismo motor que el grafo de Apoyo (react-force-graph-2d: d3-force + canvas), con FORMAS
// nuevas: Política = ESTRELLA · Función = PENTÁGONO · Detalle/Términos = DOCUMENTO. Los
// nodos inactivos (políticas desactivadas) se pintan atenuados.
const NODE_R: Record<string, number> = { policy: 6, function: 4.3 };
const BG = '#000000';

// Forma a dibujar para un nodo: estrella (política), documento (detalle/términos) o pentágono.
function shapeOf(n: PolicyGraphNode): 'star' | 'doc' | 'pentagon' {
  if (n.type === 'policy') return 'star';
  return n.functionType && FUNCTION_TYPE_META[n.functionType]?.shape === 'doc' ? 'doc' : 'pentagon';
}

// Color del nodo: la política usa su color; cada función, el de su tipo.
function colorOf(n: PolicyGraphNode): string {
  if (n.type === 'policy') return POLICY_META.policy.color;
  return (n.functionType && FUNCTION_TYPE_META[n.functionType]?.color) || POLICY_META.function.color;
}

function traceShape(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === 'star') {
    const spikes = 5, outer = r * 1.15, inner = r * 0.5;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / spikes;
      const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'doc') {
    // Documento: rectángulo con la esquina superior derecha doblada.
    const w = r * 1.5, h = r * 1.9, fold = r * 0.6;
    const left = x - w / 2, top = y - h / 2, right = x + w / 2, bottom = y + h / 2;
    ctx.moveTo(left, top);
    ctx.lineTo(right - fold, top);
    ctx.lineTo(right, top + fold);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
  } else {
    // Pentágono.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
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

export default function PolicyGraph({
  nodes, edges, selectedKey, onSelect, fitSignal = '',
}: {
  nodes: PolicyGraphNode[];
  edges: PolicyGraphEdge[];
  selectedKey: string | null;
  onSelect: (n: PolicyGraphNode | null) => void;
  fitSignal?: string;
}) {
  const fgRef = useRef<any>(null);
  const fittedRef = useRef<string | null>(null);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);
  useEffect(() => { let ok = true; import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); }); return () => { ok = false; }; }, []);

  // Reusa los mismos objetos-nodo entre renders (por key) para conservar posiciones.
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
    return { nodes: gnodes, links: edges.map((e) => ({ source: e.source, target: e.target })) };
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
  const radiusOf = (n: PolicyGraphNode) => NODE_R[n.type] + Math.min(3, Math.sqrt(degree.get(n.key) || 0) * 0.85);

  const active = hoverKey || selectedKey;
  const isLit = (key: string) => !active || key === active || !!neighbors.get(active)?.has(key);
  const linkActive = (l: any) => !!active && (linkId(l, 'source') === active || linkId(l, 'target') === active);

  useEffect(() => {
    const t = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force('charge')?.strength(-480).distanceMax(800);
      fg.d3Force('link')?.distance(150).strength(0.65);
      fg.d3ReheatSimulation?.();
      if (fittedRef.current !== fitSignal) { fittedRef.current = fitSignal; setTimeout(() => fgRef.current?.zoomToFit?.(600, 90), 700); }
    }, 300);
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
        <p className="text-[13px]" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>Sin políticas aún. Crea la primera para empezar.</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ background: BG }} className="relative w-full h-full overflow-hidden">
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
            const nn: PolicyGraphNode = n.ref;
            const c = colorOf(nn);
            const state = nn.type === 'policy' ? (nn.active ? 'Activa' : 'Inactiva') : '';
            return `<div style="max-width:240px;padding:8px 10px;background:#181826;border:1px solid #2b2b40;border-radius:8px;color:#e8e8f2;font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)">
              <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:${c};font-weight:700;margin-bottom:2px">${POLICY_META[nn.type].label}${state ? ` · ${state}` : ''}</div>
              <div style="font-size:12.5px;font-weight:600;line-height:1.25">${escapeHtml(nn.title)}</div>
            </div>`;
          }}
          linkCurvature={0.12}
          linkColor={(l: any) => (!active || linkActive(l) ? 'rgba(180,150,240,0.5)' : 'rgba(120,120,150,0.12)')}
          linkWidth={(l: any) => (linkActive(l) ? 1.8 : !active ? 1 : 0.45)}
          linkDirectionalArrowLength={(l: any) => (linkActive(l) ? 3.6 : 2.4)}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalArrowColor={() => 'rgba(210,190,250,0.7)'}
          linkDirectionalParticles={(l: any) => (linkActive(l) ? 3 : 0)}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleColor={() => '#c4b5fd'}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const n: PolicyGraphNode = node.ref;
            const baseColor = colorOf(n);
            // Política inactiva → gris atenuado (aún no aplica en la app).
            const inactivePolicy = n.type === 'policy' && !n.active;
            const color = inactivePolicy ? '#6b7280' : baseColor;
            const r = radiusOf(n);
            if (!Number.isFinite(r) || r <= 0) return;
            const lit = isLit(node.id);
            const isActiveNode = node.id === active;
            const isSel = node.id === selectedKey;
            const alpha = lit ? (inactivePolicy ? 0.6 : 1) : 0.2;

            // Halo
            const glowR = r * (isActiveNode ? 3.2 : 2.4);
            const glow = ctx.createRadialGradient(node.x, node.y, r * 0.2, node.x, node.y, glowR);
            glow.addColorStop(0, hexA(color, lit ? (isActiveNode ? 0.5 : 0.32) : 0.08));
            glow.addColorStop(1, hexA(color, 0));
            ctx.globalAlpha = 1; ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI); ctx.fill();

            // Anillo del seleccionado
            if (isSel) {
              ctx.globalAlpha = lit ? 0.75 : 0.22;
              traceShape(ctx, shapeOf(n), node.x, node.y, r + 3.4);
              ctx.strokeStyle = hexA(color, 0.9); ctx.lineWidth = 1.4; ctx.stroke();
            }

            // Forma
            const rr = isActiveNode ? r + 1 : r;
            const g = ctx.createRadialGradient(node.x, node.y, rr * 0.25, node.x, node.y, rr * 1.05);
            g.addColorStop(0, color);
            g.addColorStop(1, mix(color, '#000000', 0.3));
            traceShape(ctx, shapeOf(n), node.x, node.y, rr);
            ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fill();
            ctx.globalAlpha = alpha * 0.85; ctx.lineWidth = 0.9; ctx.strokeStyle = mix(color, '#000000', 0.45); ctx.stroke();

            // Punto verde de "activa" sobre la política activa.
            if (n.type === 'policy' && n.active) {
              const br = Math.max(2.2, rr * 0.5);
              const bx = node.x + rr * 0.72, by = node.y - rr * 0.86;
              ctx.globalAlpha = lit ? 1 : 0.35;
              ctx.beginPath(); ctx.arc(bx, by, br + 0.9, 0, 2 * Math.PI); ctx.fillStyle = 'rgba(10,10,16,0.95)'; ctx.fill();
              ctx.beginPath(); ctx.arc(bx, by, br, 0, 2 * Math.PI); ctx.fillStyle = '#22c55e'; ctx.fill();
            }
            ctx.globalAlpha = alpha;

            const showLabel = scale >= 1.15 || (active ? lit : n.type === 'policy');
            if (showLabel) {
              const label = n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title;
              const fontSize = Math.max(3.2, 11 / scale);
              ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
              ctx.textAlign = 'center'; ctx.textBaseline = 'top';
              ctx.globalAlpha = lit ? 1 : 0.28;
              ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
              ctx.fillStyle = isActiveNode ? '#ffffff' : '#d8d9ec';
              ctx.fillText(label, node.x, node.y + r + Math.max(6, fontSize * 0.7));
              ctx.shadowBlur = 0;
            }
            ctx.globalAlpha = 1;
          }}
          nodePointerAreaPaint={(node: any, colorStr: string, ctx: CanvasRenderingContext2D) => {
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const n: PolicyGraphNode = node.ref;
            ctx.fillStyle = colorStr;
            traceShape(ctx, shapeOf(n), node.x, node.y, radiusOf(n) + 3); ctx.fill();
          }}
        />
      )}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
