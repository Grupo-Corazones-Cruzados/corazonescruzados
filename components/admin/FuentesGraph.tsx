'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Plus, Minus, Shuffle, Boxes, Network, GitBranch, Folder, Table2 } from 'lucide-react';
import type { TreeNode, NodeKind } from '@/lib/admin/fuentes-tree';

/**
 * Vista "Universo" de Fuentes — el mismo motor de grafos que el sistema Gestión de Datos
 * (`react-force-graph-2d`: d3-force sobre canvas), aplicado al esquema de la base.
 *
 * Dos tipos de arista:
 *  · **Jerarquía**: módulo → sistema → subsistema → tabla. Es exactamente el árbol del
 *    panel izquierdo, así que se ve a qué pertenece cada tabla.
 *  · **Relación**: tabla → tabla, y SOLO claves foráneas declaradas en la base.
 *
 * Al seleccionar algo, el grafo enciende su vecindad y **resalta las flechas** que la
 * conectan, atenuando el resto:
 *  · una **tabla** → sus FKs + su cadena de carpetas hasta el módulo;
 *  · una **carpeta** (módulo/sistema/subsistema) → **todo su subárbol** (sistemas,
 *    subsistemas y tablas que contiene) + sus ancestros.
 *
 * Los iconos son los MISMOS de lucide que usa el panel de tablas, dibujados sobre el
 * canvas a partir de la geometría del propio icono, para que el universo y el árbol se
 * lean igual.
 */

export interface GraphRelation {
  source: string;
  target: string;
  columns: string[];
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
const GLASS = 'rounded-md bg-black/50 border border-white/10 backdrop-blur-sm';

/** Paleta legible sobre negro; se reparte entre los módulos raíz por orden. */
const PALETTE = [
  '#8267d4', '#4aa3f0', '#42c9a0', '#e0b34d', '#f08a4b', '#f1707b', '#b39ddb', '#6bb700',
  '#f472b6', '#4dd0e1', '#ffa726', '#9ccc65', '#7986cb', '#ff8a65', '#4db6ac', '#ba68c8',
  '#aed581', '#64b5f6', '#dce775', '#a1887f',
];

/** Lado del icono en unidades del grafo (los iconos de lucide son 24×24). */
const SIZE: Record<Kind, number> = {
  module: 15, system: 12.5, subsystem: 10.5, group: 10.5, table: 8,
};

/* ── Iconos: la MISMA geometría de lucide-react que usa el panel de tablas ──────
   Se copian las primitivas del icono (lienzo 24×24) para poder trazarlas en canvas.
   Fuente: lucide-react v0.468 → Boxes · Network · GitBranch · Folder · Table2.      */
type Prim =
  | { t: 'path'; d: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r: number }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number };

const ICON: Record<Kind, Prim[]> = {
  // Boxes
  module: [
    { t: 'path', d: 'M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z' },
    { t: 'path', d: 'm7 16.5-4.74-2.85' },
    { t: 'path', d: 'm7 16.5 5-3' },
    { t: 'path', d: 'M7 16.5v5.17' },
    { t: 'path', d: 'M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z' },
    { t: 'path', d: 'm17 16.5-5-3' },
    { t: 'path', d: 'm17 16.5 4.74-2.85' },
    { t: 'path', d: 'M17 16.5v5.17' },
    { t: 'path', d: 'M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z' },
    { t: 'path', d: 'M12 8 7.26 5.15' },
    { t: 'path', d: 'm12 8 4.74-2.85' },
    { t: 'path', d: 'M12 13.5V8' },
  ],
  // Network
  system: [
    { t: 'rect', x: 16, y: 16, w: 6, h: 6, r: 1 },
    { t: 'rect', x: 2, y: 16, w: 6, h: 6, r: 1 },
    { t: 'rect', x: 9, y: 2, w: 6, h: 6, r: 1 },
    { t: 'path', d: 'M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3' },
    { t: 'path', d: 'M12 12V8' },
  ],
  // GitBranch
  subsystem: [
    { t: 'line', x1: 6, y1: 3, x2: 6, y2: 15 },
    { t: 'circle', cx: 18, cy: 6, r: 3 },
    { t: 'circle', cx: 6, cy: 18, r: 3 },
    { t: 'path', d: 'M18 9a9 9 0 0 1-9 9' },
  ],
  // Folder
  group: [
    { t: 'path', d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' },
  ],
  // Table2
  table: [
    { t: 'path', d: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18' },
  ],
};

/** Cache de Path2D por icono: reconstruirlos en cada frame es caro con 219 nodos. */
const pathCache = new Map<string, Path2D[]>();
function pathsOf(kind: Kind): Path2D[] {
  const hit = pathCache.get(kind);
  if (hit) return hit;
  const out = ICON[kind].map((p) => {
    if (p.t === 'path') return new Path2D(p.d);
    const path = new Path2D();
    if (p.t === 'rect') {
      // `roundRect` es reciente; si no está, un rectángulo recto sirve igual.
      if (typeof path.roundRect === 'function') path.roundRect(p.x, p.y, p.w, p.h, p.r);
      else path.rect(p.x, p.y, p.w, p.h);
    } else if (p.t === 'circle') {
      path.arc(p.cx, p.cy, p.r, 0, 2 * Math.PI);
    } else {
      path.moveTo(p.x1, p.y1);
      path.lineTo(p.x2, p.y2);
    }
    return path;
  });
  pathCache.set(kind, out);
  return out;
}

/** Dibuja el icono de lucide centrado en (x,y) con el lado `size`. */
function drawIcon(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, size: number, color: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;            // grosor de lucide, en unidades del lienzo 24×24
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const p of pathsOf(kind)) ctx.stroke(p);
  ctx.restore();
}

const hexToRgb = (h: string) => {
  const s = h.replace('#', '');
  return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16) };
};
const hexA = (h: string, a: number) => { const { r, g, b } = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
const endId = (l: any, end: 'source' | 'target') => (typeof l[end] === 'object' ? l[end].id : l[end]);
const tableId = (name: string) => `t:${name}`;

/** Etiqueta y icono de cada tipo — los MISMOS del panel de tablas. */
const KIND_META: { kind: Kind; label: string; Icon: typeof Boxes }[] = [
  { kind: 'module', label: 'Módulos', Icon: Boxes },
  { kind: 'system', label: 'Sistemas', Icon: Network },
  { kind: 'subsystem', label: 'Subsistemas', Icon: GitBranch },
  { kind: 'group', label: 'Otras', Icon: Folder },
  { kind: 'table', label: 'Tablas', Icon: Table2 },
];
const KIND_ES: Record<Kind, string> = {
  module: 'Módulo', system: 'Sistema', subsystem: 'Subsistema', group: 'Carpeta', table: 'Tabla',
};

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
    nodes.push({ id: node.id, kind: node.kind, label: node.name, root, path: path.join(' ▸ '), parent });
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

  // Carpeta elegida DENTRO del universo (la tabla elegida vive en el panel izquierdo).
  const [pickedFolder, setPickedFolder] = useState<string | null>(null);
  // Filtro por tipo: el puntero lo previsualiza, el clic lo fija (igual que Gestión de Datos).
  const [pinFilter, setPinFilter] = useState<Kind | null>(null);
  const [hoverFilter, setHoverFilter] = useState<Kind | null>(null);
  const filter = hoverFilter ?? pinFilter;

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
      .map((r) => ({ source: tableId(r.source), target: tableId(r.target), rel: 'fk' as const, columns: r.columns }));
    return { nodes: flat.nodes, links: [...flat.links, ...rel] };
  }, [tree, relations]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const countByKind = useMemo(() => {
    const m = new Map<Kind, number>();
    nodes.forEach((n) => m.set(n.kind, (m.get(n.kind) || 0) + 1));
    return m;
  }, [nodes]);

  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of nodes) {
      if (!n.parent) continue;
      const list = m.get(n.parent);
      if (list) list.push(n.id);
      else m.set(n.parent, [n.id]);
    }
    return m;
  }, [nodes]);

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
  const activeId = hover || pickedFolder || (selectedTable ? tableId(selectedTable) : null);

  const lit = useMemo(() => {
    // El filtro por tipo manda sobre la selección.
    if (filter) return new Set(nodes.filter((n) => n.kind === filter).map((n) => n.id));
    if (!activeId) return null;

    const set = new Set<string>([activeId]);
    // Relaciones de datos (solo aplica a tablas).
    relNeighbors.get(activeId)?.forEach((k) => set.add(k));
    // Ancestros: la cadena de carpetas hasta el módulo.
    let cur = byId.get(activeId)?.parent ?? null;
    while (cur) { set.add(cur); cur = byId.get(cur)?.parent ?? null; }
    // Descendientes: si es carpeta, TODO su subárbol (sistemas, subsistemas y tablas).
    if (byId.get(activeId)?.kind !== 'table') {
      const stack = [activeId];
      while (stack.length) {
        for (const child of childrenOf.get(stack.pop()!) ?? []) {
          if (set.has(child)) continue;
          set.add(child);
          stack.push(child);
        }
      }
    }
    return set;
  }, [filter, activeId, nodes, relNeighbors, byId, childrenOf]);

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
  // Se leen dentro de los timeouts: así usan siempre la selección vigente.
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
    setPickedFolder(null);
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

  /* ── Ficha de lo seleccionado ─────────────────────────────────────────── */
  const focusNode = pickedFolder ? byId.get(pickedFolder) : selectedTable ? byId.get(tableId(selectedTable)) : null;
  const selRels = useMemo(() => {
    if (!selectedTable || pickedFolder) return { out: [] as GraphRelation[], in: [] as GraphRelation[] };
    return {
      out: relations.filter((r) => r.source === selectedTable),
      in: relations.filter((r) => r.target === selectedTable),
    };
  }, [relations, selectedTable, pickedFolder]);
  /** Cuántas tablas cuelgan de la carpeta enfocada (subárbol completo). */
  const folderTables = useMemo(() => {
    if (!pickedFolder || !lit) return 0;
    return [...lit].filter((id) => byId.get(id)?.kind === 'table').length;
  }, [pickedFolder, lit, byId]);

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

      {/* Leyenda-filtro: el puntero previsualiza el resaltado, el clic lo fija/quita. */}
      <div className={`absolute top-2.5 left-2.5 z-10 ${GLASS} p-2 w-[168px]`}>
        <p className="text-[9.5px] uppercase tracking-wide text-white/50 mb-1.5 px-0.5" style={{ fontFamily: 'var(--font-body)' }}>
          Tipos
        </p>
        <div className="grid grid-cols-1 gap-0.5">
          {KIND_META.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              onMouseEnter={() => setHoverFilter(kind)}
              onMouseLeave={() => setHoverFilter(null)}
              onClick={() => setPinFilter((p) => (p === kind ? null : kind))}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${
                pinFilter === kind ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 text-white/85" />
              <span className="text-[11px] text-white/85 flex-1" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
              <span className="text-[10px] text-white/45" style={{ fontFamily: 'var(--font-body)' }}>
                {countByKind.get(kind) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Ficha de lo enfocado */}
      {focusNode && (
        <div className={`absolute bottom-2.5 left-2.5 z-10 max-w-[340px] ${GLASS} px-3 py-2.5 text-white/80`}
             style={{ fontFamily: 'var(--font-body)' }}>
          <p className="text-[12.5px] font-semibold text-white">{focusNode.label}</p>
          <p className="text-[10.5px] text-white/55 mt-0.5">
            {KIND_ES[focusNode.kind]}{focusNode.path ? ` · ${focusNode.path}` : ''}
          </p>
          {focusNode.kind === 'table' ? (
            <>
              <p className="text-[10.5px] text-white/55">
                {(focusNode.rows ?? 0).toLocaleString('es-ES')} filas · {selRels.out.length + selRels.in.length} relaciones
              </p>
              {!!selRels.out.length && (
                <p className="text-[10.5px] mt-1.5">
                  <span className="text-white/50">Apunta a:</span> {selRels.out.map((r) => r.target).join(', ')}
                </p>
              )}
              {!!selRels.in.length && (
                <p className="text-[10.5px] mt-0.5">
                  <span className="text-white/50">Le apuntan:</span> {selRels.in.map((r) => r.source).join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="text-[10.5px] text-white/55">
              {folderTables} {folderTables === 1 ? 'tabla' : 'tablas'} en su interior
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
          onBackgroundClick={() => { setPickedFolder(null); setPinFilter(null); }}
          onNodeHover={(n: any) => setHover(n ? n.id : null)}
          onNodeClick={(n: any) => {
            const d: GNode | undefined = n?.ref;
            if (!d) return;
            if (d.kind === 'table') { setPickedFolder(null); onSelectTable(d.label); }
            else setPickedFolder((p) => (p === d.id ? null : d.id));
            fgRef.current?.centerAt(n.x, n.y, 500);
          }}
          nodeLabel={(n: any) => {
            const d: GNode = n.ref;
            const rows = d.kind === 'table' ? ` · ${(d.rows ?? 0).toLocaleString('es-ES')} filas` : '';
            return `<div style="font-family:var(--font-body);font-size:11px;line-height:1.35">
              <b>${d.label}</b><br/><span style="opacity:.65">${KIND_ES[d.kind]}${rows}</span>
              ${d.path ? `<br/><span style="opacity:.5">${d.path}</span>` : ''}
            </div>`;
          }}
          linkColor={(l: any) => {
            if (!linkLit(l)) return 'rgba(255,255,255,0.025)';
            const c = colorByRoot.get(byId.get(endId(l, 'source'))?.root ?? '') ?? '#ffffff';
            // Con algo enfocado, las aristas de la vecindad se encienden a tope.
            if (lit) return l.rel === 'tree' ? hexA(c, 0.9) : '#ffffff';
            return l.rel === 'tree' ? 'rgba(255,255,255,0.13)' : hexA(c, 0.75);
          }}
          linkWidth={(l: any) => {
            if (!lit) return l.rel === 'tree' ? 0.5 : 1;
            if (!linkLit(l)) return 0.4;
            return l.rel === 'tree' ? 1.6 : 2.4;
          }}
          linkDirectionalArrowLength={(l: any) => (l.rel === 'tree' ? 0 : linkLit(l) && lit ? 4.5 : 2.6)}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={(l: any) => (lit && linkLit(l) && l.rel === 'fk' ? 2 : 0)}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => '#ffffff'}
          nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, scale: number) => {
            const d: GNode = n.ref;
            const on = isLit(n.id);
            const color = colorByRoot.get(d.root) ?? '#ffffff';
            const size = SIZE[d.kind];
            const isFocus = n.id === activeId;

            // Halo del enfocado
            if (isFocus) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, size * 0.85, 0, 2 * Math.PI);
              ctx.fillStyle = hexA(color, 0.25);
              ctx.fill();
            }

            drawIcon(ctx, d.kind, n.x, n.y, size, on ? (isFocus ? '#ffffff' : color) : hexA(color, 0.13));

            // Etiquetas: las carpetas siempre; las tablas solo con zoom, al pasar por
            // encima o si están enfocadas (si no, 172 nombres se solapan).
            const showLabel = d.kind !== 'table' || scale > 2.2 || isFocus;
            if (showLabel && on) {
              const fs = (d.kind === 'module' ? 4.6 : d.kind === 'table' ? 3.2 : 3.8) * Math.min(1.6, 12 / scale);
              ctx.font = `${d.kind === 'table' ? '' : '600 '}${fs}px var(--font-body), sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = d.kind === 'table' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.95)';
              ctx.fillText(d.label, n.x, n.y + size / 2 + 1.5);
            }
          }}
          nodePointerAreaPaint={(n: any, color: string, ctx: CanvasRenderingContext2D) => {
            const size = SIZE[(n.ref as GNode).kind];
            ctx.beginPath();
            ctx.arc(n.x, n.y, size * 0.7, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      )}
    </div>
  );
}
