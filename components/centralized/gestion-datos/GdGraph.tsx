'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle } from 'lucide-react';
import { GD_NODE_META, CODIGO_UNVERIFIED_COLOR } from '@/lib/centralized/gestion-datos';
import type { GdGraphNode, GdGraphEdge } from '@/lib/centralized/gestion-datos';

// Mismo motor que Comandos Violeta / Apoyo (react-force-graph-2d: d3-force + canvas), con las
// formas de la tubería de clasificación: Problema=triángulo · Fuente premisa=círculo ·
// Fuente peso=cuadrado · Enfrentamiento=rombo · Código=hexágono · Categoría=estrella.
const NODE_R: Record<string, number> = {
  problema: 5, fuente_premisa: 5, fuente_peso: 4.2, enfrentamiento: 5, codigo: 5.6, categoria: 6.4,
};
const BG = '#000000';

function colorOf(n: GdGraphNode): string {
  if (n.type === 'codigo' && !n.verificado) return CODIGO_UNVERIFIED_COLOR;
  return GD_NODE_META[n.type].color;
}
function shapeOf(n: GdGraphNode): string {
  return GD_NODE_META[n.type].shape;
}

function traceShape(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  } else if (shape === 'square') {
    const s = r * 0.92;
    ctx.rect(x - s, y - s, s * 2, s * 2);
  } else if (shape === 'triangle') {
    const rr = r * 1.18;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'diamond') {
    const rr = r * 1.15;
    ctx.moveTo(x, y - rr); ctx.lineTo(x + rr, y); ctx.lineTo(x, y + rr); ctx.lineTo(x - rr, y);
    ctx.closePath();
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * 2 * Math.PI) / 6;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'pentagon') {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
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
  } else if (shape === 'card') {
    // Tarjeta: rectángulo apaisado.
    const w = r * 1.7, h = r * 1.2;
    ctx.rect(x - w / 2, y - h / 2, w, h);
  } else if (shape === 'octagon') {
    const rr = r * 1.08;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * 2 * Math.PI) / 8;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else {
    // star
    const spikes = 5, outer = r * 1.15, inner = r * 0.5;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / spikes;
      const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a);
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

export type GdLegendFilter = { kind: 'type' | 'state'; value: string } | null;

export default function GdGraph({
  nodes, edges, selectedKey, onSelect, fitSignal = '', filter = null,
}: {
  nodes: GdGraphNode[];
  edges: GdGraphEdge[];
  selectedKey: string | null;
  onSelect: (n: GdGraphNode | null) => void;
  fitSignal?: string;
  filter?: GdLegendFilter;
}) {
  const fgRef = useRef<any>(null);
  const fittedRef = useRef<string | null>(null);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);
  useEffect(() => { let ok = true; import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); }); return () => { ok = false; }; }, []);

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
  const radiusOf = (n: GdGraphNode) => (NODE_R[n.type] || 5) + Math.min(3, Math.sqrt(degree.get(n.key) || 0) * 0.85);

  const active = hoverKey || selectedKey;
  const filtering = !!filter;
  const matchesFilter = (key: string) => {
    if (!filter) return true;
    const n = nodeByKey.get(key);
    if (!n) return false;
    if (filter.kind === 'state') {
      if (n.type !== 'codigo') return false;
      return filter.value === 'verificado' ? !!n.verificado : !n.verificado;
    }
    return n.type === filter.value;
  };
  const isLit = (key: string) => (filtering ? matchesFilter(key) : (!active || key === active || !!neighbors.get(active)?.has(key)));
  const linkActive = (l: any) => !!active && (linkId(l, 'source') === active || linkId(l, 'target') === active);
  const linkLit = (l: any) => (filtering ? (matchesFilter(linkId(l, 'source')) && matchesFilter(linkId(l, 'target'))) : (!active || linkActive(l)));

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
        <p className="text-[13px] text-center px-6" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>
          Sin datos aún. Agrega fuentes y problemas para empezar a clasificar.
        </p>
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
            const nn: GdGraphNode = n.ref;
            const c = colorOf(nn);
            const meta = GD_NODE_META[nn.type];
            const state = nn.type === 'codigo' ? (nn.verificado ? ' · Verificado' : ' · No verificado') : '';
            const cred = nn.type === 'fuente_premisa' && nn.credibilidad != null ? ` · ${Math.round(nn.credibilidad)}%` : '';
            const sub = nn.subtitle ? `<div style="font-size:11px;color:#a9aac2;line-height:1.3;margin-top:3px">${escapeHtml(nn.subtitle.slice(0, 120))}${nn.subtitle.length > 120 ? '…' : ''}</div>` : '';
            return `<div style="max-width:260px;padding:8px 10px;background:#181826;border:1px solid #2b2b40;border-radius:8px;color:#e8e8f2;font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)">
              <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:${c};font-weight:700;margin-bottom:2px">${meta.label}${state}${cred}</div>
              <div style="font-size:12.5px;font-weight:600;line-height:1.25">${escapeHtml(nn.title)}</div>
              ${sub}
            </div>`;
          }}
          linkCurvature={0.1}
          linkColor={(l: any) => (linkLit(l) ? 'rgba(150,170,240,0.45)' : 'rgba(120,120,150,0.12)')}
          linkWidth={(l: any) => (linkActive(l) ? 1.8 : linkLit(l) ? (filtering ? 1.4 : 1) : 0.45)}
          linkDirectionalArrowLength={(l: any) => (linkActive(l) ? 3.6 : 2.4)}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalArrowColor={() => 'rgba(200,210,250,0.7)'}
          linkDirectionalParticles={(l: any) => (linkActive(l) ? 3 : 0)}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleSpeed={0.007}
          linkDirectionalParticleColor={() => '#a5b4fc'}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const n: GdGraphNode = node.ref;
            const color = colorOf(n);
            const r = radiusOf(n);
            if (!Number.isFinite(r) || r <= 0) return;
            const lit = isLit(node.id);
            const isActiveNode = node.id === active;
            const isSel = node.id === selectedKey;
            const unverifiedCode = n.type === 'codigo' && !n.verificado;
            const alpha = lit ? (unverifiedCode ? 0.62 : 1) : (filtering ? 0.07 : 0.2);

            // Halo
            const glowR = r * (isActiveNode ? 3.2 : 2.4);
            const glow = ctx.createRadialGradient(node.x, node.y, r * 0.2, node.x, node.y, glowR);
            glow.addColorStop(0, hexA(color, lit ? (isActiveNode ? 0.5 : 0.3) : 0.08));
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

            // Código VERIFICADO → anillo esmeralda energizado (elegante señal de "validado").
            if (n.type === 'codigo' && n.verificado) {
              ctx.save();
              ctx.globalAlpha = lit ? 1 : 0.3;
              ctx.shadowColor = 'rgba(52,211,153,0.9)';
              ctx.shadowBlur = 9;
              traceShape(ctx, 'hexagon', node.x, node.y, rr + 2.1);
              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.restore();
            }
            ctx.globalAlpha = alpha;

            const showLabel = scale >= 1.15 || (active ? lit : n.type === 'categoria' || n.type === 'codigo');
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
            const n: GdGraphNode = node.ref;
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
