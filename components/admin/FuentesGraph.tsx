'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle } from 'lucide-react';
import type { TreeNode, NodeKind } from '@/lib/admin/fuentes-tree';

/**
 * Vista "Universo" de Fuentes — el mismo motor de grafos que el sistema Gestión de Datos
 * (`react-force-graph-2d`: d3-force sobre canvas), aplicado al esquema de la base.
 *
 * En el universo conviven DOS tipos de arista:
 *  · **Jerarquía** (línea tenue): módulo → sistema → subsistema → tabla. Es exactamente el
 *    árbol del panel izquierdo, así que se ve a qué pertenece cada tabla.
 *  · **Relación** (línea marcada): tabla → tabla. Sólida si es una FK declarada, punteada
 *    si está inferida por el nombre de la columna (`<algo>_id`).
 *
 * Al seleccionar una tabla (aquí o en el panel izquierdo) el grafo la centra y deja
 * encendidas solo sus relaciones y su cadena de carpetas; el resto se atenúa.
 */

export interface GraphRelation {
  source: string;
  target: string;
  columns: string[];
  declared: boolean;
}

type Kind = NodeKind | 'table';

interface GNode {
  id: string;
  kind: Kind;
  label: string;
  /** Módulo raíz: define el color, para que cada familia se vea como una constelación. */
  root: string;
  rows?: number;
  /** Ruta de carpetas (`Centralizado ▸ Gestión de Datos ▸ …`). */
  path: string;
  parent: string | null;
}

const BG = '#05060a';

/** Paleta legible sobre negro; se reparte entre los módulos raíz por orden. */
const PALETTE = [
  '#8267d4', '#4aa3f0', '#42c9a0', '#e0b34d', '#f08a4b', '#f1707b', '#b39ddb', '#6bb700',
  '#f472b6', '#4dd0e1', '#ffa726', '#9ccc65', '#7986cb', '#ff8a65', '#4db6ac', '#ba68c8',
  '#aed581', '#64b5f6', '#dce775', '#a1887f',
];

const RADIUS: Record<Kind, number> = {
  module: 9, system: 7, subsystem: 5.5, group: 5.5, table: 4,
};

const tableId = (name: string) => `t:${name}`;

function traceShape(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === 'table') {
    ctx.arc(x, y, r, 0, 2 * Math.PI);
  } else if (kind === 'module') {
    // Estrella
    const outer = r * 1.15, inner = r * 0.5;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + rad * Math.cos(a), py = y + rad * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (kind === 'system') {
    // Hexágono
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * 2 * Math.PI) / 6;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (kind === 'subsystem') {
    // Rombo
    const rr = r * 1.15;
    ctx.moveTo(x, y - rr); ctx.lineTo(x + rr, y); ctx.lineTo(x, y + rr); ctx.lineTo(x - rr, y);
    ctx.closePath();
  } else {
    // Cuadrado (otras carpetas)
    const s = r * 0.92;
    ctx.rect(x - s, y - s, s * 2, s * 2);
  }
}

const hexToRgb = (h: string) => {
  const s = h.replace('#', '');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
};
const hexA = (h: string, a: number) => { const { r, g, b } = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
const endId = (l: any, end: 'source' | 'target') => (typeof l[end] === 'object' ? l[end].id : l[end]);

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setSize({ width: Math.max(320, Math.floor(w)), height: Math.max(280, Math.floor(h)) });
    const ro = new ResizeObserver((e) => apply(e[0].contentRect.width, e[0].contentRect.height));
    ro.observe(el);
    apply(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

/** Aplana el árbol de carpetas en nodos + aristas de jerarquía. */
function flatten(tree: TreeNode[]) {
  const nodes: GNode[] = [];
  const links: { source: string; target: string; rel: 'tree' }[] = [];

  const walk = (node: TreeNode, parent: string | null, root: string, path: string[]) => {
    const here = [...path, node.name];
    nodes.push({
      id: node.id, kind: node.kind, label: node.name, root,
      path: path.join(' ▸ '), parent,
    });
    if (parent) links.push({ source: parent, target: node.id, rel: 'tree' });

    node.children.forEach((c) => walk(c, node.id, root, here));
    node.tables.forEach((t) => {
      nodes.push({
        id: tableId(t.name), kind: 'table', label: t.name, root,
        rows: t.rows, path: here.join(' ▸ '), parent: node.id,
      });
      links.push({ source: node.id, target: tableId(t.name), rel: 'tree' });
    });
  };

  tree.forEach((n) => walk(n, null, n.name, []));
  return { nodes, links };
}

export default function FuentesGraph({
  tree,
  relations,
  selectedTable,
  onSelectTable,
}: {
  tree: TreeNode[];
  relations: GraphRelation[];
  selectedTable: string | null;
  onSelectTable: (name: string) => void;
}) {
  const fgRef = useRef<any>(null);
  const { ref, width, height } = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const [ForceGraph2D, setForceGraph2D] = useState<any>(null);

  useEffect(() => {
    let ok = true;
    import('react-force-graph-2d').then((m) => { if (ok) setForceGraph2D(() => m.default); });
    return () => { ok = false; };
  }, []);

  /* ── Nodos y aristas ──────────────────────────────────────────────────── */
  const { nodes, links } = useMemo(() => {
    const flat = flatten(tree);
    const ids = new Set(flat.nodes.map((n) => n.id));
    const rel = relations
      .filter((r) => ids.has(tableId(r.source)) && ids.has(tableId(r.target)))
      .map((r) => ({
        source: tableId(r.source),
        target: tableId(r.target),
        rel: (r.declared ? 'fk' : 'guess') as 'fk' | 'guess',
        columns: r.columns,
      }));
    return { nodes: flat.nodes, links: [...flat.links, ...rel] };
  }, [tree, relations]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const colorByRoot = useMemo(() => {
    const roots = [...new Set(nodes.map((n) => n.root))];
    return new Map(roots.map((r, i) => [r, PALETTE[i % PALETTE.length]]));
  }, [nodes]);

  /** Vecinos por relación de datos (NO por jerarquía). */
  const relNeighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) {
      if (l.rel === 'tree') continue;
      if (!m.has(l.source)) m.set(l.source, new Set());
      if (!m.has(l.target)) m.set(l.target, new Set());
      m.get(l.source)!.add(l.target);
      m.get(l.target)!.add(l.source);
    }
    return m;
  }, [links]);

  // Objetos del grafo cacheados por id: si se recrean, d3 pierde las posiciones y
  // el universo "salta" en cada render.
  const objRef = useRef<Map<string, any>>(new Map());
  const graphData = useMemo(() => {
    const cache = objRef.current;
    const keep = new Set<string>();
    const gnodes = nodes.map((n) => {
      keep.add(n.id);
      let o = cache.get(n.id);
      if (!o) { o = { id: n.id }; cache.set(n.id, o); }
      o.ref = n;
      return o;
    });
    for (const k of Array.from(cache.keys())) if (!keep.has(k)) cache.delete(k);
    return { nodes: gnodes, links: links.map((l) => ({ ...l })) };
  }, [nodes, links]);

  /* ── Resaltado ────────────────────────────────────────────────────────── */
  const activeId = hover || (selectedTable ? tableId(selectedTable) : null);

  /** Nodo activo + sus relaciones de datos + su cadena de carpetas hasta el módulo. */
  const lit = useMemo(() => {
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    relNeighbors.get(activeId)?.forEach((k) => set.add(k));
    let cur = byId.get(activeId)?.parent ?? null;
    while (cur) { set.add(cur); cur = byId.get(cur)?.parent ?? null; }
    // Si el activo es una carpeta, se encienden sus hijos directos.
    if (byId.get(activeId)?.kind !== 'table') {
      nodes.forEach((n) => { if (n.parent === activeId) set.add(n.id); });
    }
    return set;
  }, [activeId, relNeighbors, byId, nodes]);

  const isLit = (id: string) => !lit || lit.has(id);
  const linkLit = (l: any) => !lit || (lit.has(endId(l, 'source')) && lit.has(endId(l, 'target')));

  /* ── Encuadre y centrado ──────────────────────────────────────────────── */
  const fitView = (duration = 500) => fgRef.current?.zoomToFit?.(duration, 60);

  /** Viaja hasta la tabla seleccionada. `false` si aún no tiene posición. */
  const focusSelected = (duration = 700): boolean => {
    const fg = fgRef.current;
    if (!fg || !selectedTable) return false;
    const o = objRef.current.get(tableId(selectedTable));
    if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) return false;
    fg.centerAt(o.x, o.y, duration);
    fg.zoom(Math.max(fg.zoom(), 1.8), duration);
    return true;
  };
  // Se lee dentro de los timeouts: así usan siempre la selección vigente.
  const focusRef = useRef(focusSelected);
  focusRef.current = focusSelected;
  const selectedRef = useRef(selectedTable);
  selectedRef.current = selectedTable;

  useEffect(() => {
    if (!ForceGraph2D) return;
    const t = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force('charge')?.strength(-260).distanceMax(700);
      fg.d3Force('link')?.distance((l: any) => (l.rel === 'tree' ? 44 : 130)).strength((l: any) => (l.rel === 'tree' ? 1 : 0.18));
      fg.d3ReheatSimulation?.();
      // Si se abre el universo con una tabla ya elegida, se va a ella en vez de
      // encuadrar todo (el encuadre pisaría el centrado).
      const t2 = setTimeout(() => {
        if (!(selectedRef.current && focusRef.current(600))) fitView(600);
      }, 900);
      return () => clearTimeout(t2);
    }, 250);
    return () => clearTimeout(t);
  }, [ForceGraph2D]);

  // Al elegir una tabla en el panel izquierdo, el universo viaja hasta ella.
  useEffect(() => {
    if (!selectedTable) return;
    if (focusSelected()) return;
    const t = setTimeout(() => focusRef.current(), 450);  // aún sin posición: reintenta
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, ForceGraph2D]);

  const zoomBy = (f: number) => { const fg = fgRef.current; if (fg) fg.zoom(fg.zoom() * f, 250); };

  const Ctrl = ({ onClick, title, children }: any) => (
    <button
      onClick={onClick} title={title} aria-label={title}
      className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 border border-white/10 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
    >
      {children}
    </button>
  );

  /* ── Ficha de la tabla seleccionada ───────────────────────────────────── */
  const selNode = selectedTable ? byId.get(tableId(selectedTable)) : null;
  const selRels = useMemo(() => {
    if (!selectedTable) return { out: [] as GraphRelation[], in: [] as GraphRelation[] };
    return {
      out: relations.filter((r) => r.source === selectedTable),
      in: relations.filter((r) => r.target === selectedTable),
    };
  }, [relations, selectedTable]);

  return (
    <div ref={ref} style={{ background: BG }} className="relative w-full h-full overflow-hidden rounded-lg border border-digi-border">
      {ForceGraph2D && (
        <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
          <Ctrl onClick={() => fitView(400)} title="Ajustar"><Maximize2 className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={() => zoomBy(1.4)} title="Acercar"><Plus className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={() => zoomBy(1 / 1.4)} title="Alejar"><Minus className="w-4 h-4" /></Ctrl>
          <Ctrl onClick={() => fgRef.current?.d3ReheatSimulation()} title="Reorganizar"><Shuffle className="w-4 h-4" /></Ctrl>
        </div>
      )}

      {/* Leyenda */}
      <div className="absolute top-2.5 left-2.5 z-10 rounded-md bg-black/45 border border-white/10 backdrop-blur-sm px-2.5 py-2 text-white/70 pointer-events-none"
           style={{ fontFamily: 'var(--font-body)', fontSize: 10.5 }}>
        <p className="mb-1 text-white/90 font-semibold">Universo del esquema</p>
        <p>★ módulo · ⬢ sistema · ◆ subsistema · ● tabla</p>
        <p className="mt-0.5">— relación declarada (FK) · - - relación inferida · línea tenue: jerarquía</p>
      </div>

      {/* Ficha de la selección */}
      {selNode && (
        <div className="absolute bottom-2.5 left-2.5 z-10 max-w-[330px] rounded-md bg-black/60 border border-white/10 backdrop-blur-sm px-3 py-2.5 text-white/80"
             style={{ fontFamily: 'var(--font-body)' }}>
          <p className="text-[12.5px] font-semibold text-white">{selNode.label}</p>
          <p className="text-[10.5px] text-white/55 mt-0.5">{selNode.path}</p>
          <p className="text-[10.5px] text-white/55">
            {(selNode.rows ?? 0).toLocaleString('es-ES')} filas ·{' '}
            {selRels.out.length + selRels.in.length} relaciones
          </p>
          {!!selRels.out.length && (
            <p className="text-[10.5px] mt-1.5">
              <span className="text-white/50">Apunta a:</span>{' '}
              {selRels.out.map((r) => r.target).join(', ')}
            </p>
          )}
          {!!selRels.in.length && (
            <p className="text-[10.5px] mt-0.5">
              <span className="text-white/50">Le apuntan:</span>{' '}
              {selRels.in.map((r) => r.source).join(', ')}
            </p>
          )}
        </div>
      )}

      {!ForceGraph2D ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[12px] animate-pulse" style={{ color: '#8a8ba6', fontFamily: 'var(--font-body)' }}>
            Cargando universo…
          </span>
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          width={width}
          height={height}
          graphData={graphData as any}
          backgroundColor={BG}
          cooldownTicks={180}
          warmupTicks={30}
          d3VelocityDecay={0.3}
          nodeRelSize={4}
          enableNodeDrag
          onNodeHover={(n: any) => setHover(n ? n.id : null)}
          onNodeClick={(n: any) => {
            const ref_: GNode | undefined = n?.ref;
            if (ref_?.kind === 'table') onSelectTable(ref_.label);
            if (n) fgRef.current?.centerAt(n.x, n.y, 500);
          }}
          nodeLabel={(n: any) => {
            const d: GNode = n.ref;
            const kindEs = d.kind === 'table' ? 'Tabla'
              : d.kind === 'module' ? 'Módulo'
              : d.kind === 'system' ? 'Sistema'
              : d.kind === 'subsystem' ? 'Subsistema' : 'Carpeta';
            const rows = d.kind === 'table' ? ` · ${(d.rows ?? 0).toLocaleString('es-ES')} filas` : '';
            return `<div style="font-family:var(--font-body);font-size:11px;line-height:1.35">
              <b>${d.label}</b><br/><span style="opacity:.65">${kindEs}${rows}</span>
              ${d.path ? `<br/><span style="opacity:.5">${d.path}</span>` : ''}
            </div>`;
          }}
          linkColor={(l: any) => {
            if (!linkLit(l)) return 'rgba(255,255,255,0.03)';
            if (l.rel === 'tree') return 'rgba(255,255,255,0.13)';
            const c = colorByRoot.get(byId.get(endId(l, 'source'))?.root ?? '') ?? '#ffffff';
            return hexA(c, l.rel === 'fk' ? 0.85 : 0.5);
          }}
          linkWidth={(l: any) => (l.rel === 'tree' ? 0.5 : linkLit(l) && lit ? 1.8 : 1)}
          linkLineDash={(l: any) => (l.rel === 'guess' ? [3, 3] : null)}
          linkDirectionalArrowLength={(l: any) => (l.rel === 'tree' ? 0 : 2.6)}
          linkDirectionalArrowRelPos={1}
          nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, scale: number) => {
            const d: GNode = n.ref;
            const on = isLit(n.id);
            const color = colorByRoot.get(d.root) ?? '#ffffff';
            const r = RADIUS[d.kind];
            const isSel = selectedTable && n.id === tableId(selectedTable);

            // Halo del seleccionado
            if (isSel) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, r + 5, 0, 2 * Math.PI);
              ctx.fillStyle = hexA(color, 0.22);
              ctx.fill();
            }

            traceShape(ctx, d.kind, n.x, n.y, r);
            ctx.fillStyle = on ? color : hexA(color, 0.12);
            ctx.fill();
            if (d.kind !== 'table') {
              ctx.strokeStyle = on ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.1)';
              ctx.lineWidth = 0.7;
              ctx.stroke();
            }
            if (isSel) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }

            // Etiquetas: las carpetas siempre; las tablas solo con zoom, al pasar por
            // encima o si están seleccionadas (si no, 172 nombres se solapan).
            const showLabel = d.kind !== 'table' || scale > 2.2 || n.id === activeId || isSel;
            if (showLabel && on) {
              const size = (d.kind === 'module' ? 4.6 : d.kind === 'table' ? 3.2 : 3.8) * Math.min(1.6, 12 / scale);
              ctx.font = `${d.kind === 'table' ? '' : '600 '}${size}px var(--font-body), sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = d.kind === 'table' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.95)';
              ctx.fillText(d.label, n.x, n.y + r + 1.5);
            }
          }}
          nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) => {
            traceShape(ctx, (n.ref as GNode).kind, n.x, n.y, RADIUS[(n.ref as GNode).kind] + 2);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      )}
    </div>
  );
}
