'use client';

/**
 * EL LIENZO del Estudio del agente.
 *
 * ⚠️ SE CARGA CON `dynamic(..., { ssr: false })`. ELK usa APIs de navegador y pesa medio
 * mega; renderizarlo en servidor no aporta nada y hunde el peso inicial de la página.
 *
 * ── DECISIONES DE INTERACCIÓN, Y POR QUÉ ───────────────────────────────────────
 * · `nodesDraggable={false}` — mover una tarjeta daría a entender que se cambia el flujo.
 *   El flujo lo cambia el código.
 * · `nodesConnectable={false}` — esto no es un constructor.
 * · `zoomOnScroll={false}` + `panOnScroll` — la rueda RECORRE el diagrama, que es largo.
 *   El zoom vive en los botones de abajo.
 * · `elementsSelectable` ⚠️ **TIENE que estar activado**: React Flow le pone
 *   `pointer-events: none` a un nodo que no es seleccionable ni arrastrable ni conectable,
 *   y entonces los botones de dentro de la tarjeta NUNCA reciben el clic. Cuesta un rato
 *   descubrirlo porque el nodo se ve perfectamente.
 *
 * ── PALETA ─────────────────────────────────────────────────────────────────────
 * Todo sale de los tokens de `.corp`: `accent` para la marca y lo que ejecuta IA,
 * `digi-*` para superficies y texto, y los tonos semánticos remapeados. Nada de hexes
 * propios — ver `Diseño.md` → «Tonos semánticos».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Panel,
  Handle, Position, EdgeLabelRenderer, useReactFlow,
  type Node, type Edge, type NodeProps, type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Webhook, ShieldCheck, Ban, Code2, Radio, Save, Timer, Cog, ToggleLeft, KeyRound,
  Layers, Sparkles, GitBranch, Send, VolumeX, UserRound, CheckCircle2, SlidersHorizontal,
  Plug, FileText, BookText, MessageSquare, Wrench, type LucideIcon,
} from 'lucide-react';
import type { Pipeline, NodoPipeline } from '@/lib/agente/estudio/tipos';
import { colocarPipeline, TAMANO, type Colocacion } from './pipeline-layout';
import { colocarSatelites, curva, type SateliteColocado } from './satelites-layout';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** El icono viaja como CADENA desde el servidor; aquí se traduce a componente. */
const ICONOS: Record<string, LucideIcon> = {
  webhook: Webhook, escudo: ShieldCheck, stop: Ban, codigo: Code2, canal: Radio,
  guardar: Save, reloj: Timer, engranaje: Cog, interruptor: ToggleLeft, llave: KeyRound,
  capas: Layers, chispa: Sparkles, bifurcacion: GitBranch, enviar: Send, silencio: VolumeX,
  persona: UserRound, ok: CheckCircle2, ajustes: SlidersHorizontal, enchufe: Plug,
  texto: FileText, libro: BookText, chat: MessageSquare, herramienta: Wrench,
};

/** Acento por grupo. Solo tonos que `.corp` remapea en claro Y en oscuro. */
const ACENTO: Record<string, { texto: string; borde: string; fondo: string }> = {
  ingesta: { texto: 'text-blue-400', borde: 'border-blue-400/40', fondo: 'bg-blue-400/10' },
  decision: { texto: 'text-accent', borde: 'border-accent/40', fondo: 'bg-accent-light' },
  cierre: { texto: 'text-green-400', borde: 'border-green-300', fondo: 'bg-green-50' },
};

/* ═══════════════════════ NODOS ═══════════════════════ */

interface DatosPaso extends Record<string, unknown> {
  nodo: NodoPipeline;
  satelites: SateliteColocado[];
  seleccionado: boolean;
  alSeleccionarFuente: (id: string) => void;
}

function NodoPaso({ data }: NodeProps<Node<DatosPaso>>) {
  const { nodo, satelites, seleccionado, alSeleccionarFuente } = data;
  const t = TAMANO[nodo.tipo];
  const Icono = ICONOS[nodo.icono ?? ''] ?? Code2;
  const acento = ACENTO[nodo.grupo] ?? ACENTO.ingesta;
  const esIA = nodo.ejecucion === 'ia';
  const esCondicion = nodo.tipo === 'condicion';

  return (
    <div className="relative" style={{ width: t.ancho }}>
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />

      {/* ── El abanico, en SVG por detrás de las píldoras ── */}
      {satelites.length > 0 && (
        <svg
          className="absolute pointer-events-none overflow-visible"
          style={{ left: 0, top: 0, width: 1, height: 1 }}
        >
          {satelites.map((s) => (
            <path key={s.id} d={curva(s.desde.x, s.desde.y, s.x, s.y + s.alto / 2)}
              fill="none" stroke="var(--color-digi-border)" strokeWidth={1.5} strokeDasharray="4 4" />
          ))}
        </svg>
      )}
      {satelites.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={(e) => { e.stopPropagation(); if (s.fuenteId) alSeleccionarFuente(s.fuenteId); }}
          disabled={!s.fuenteId}
          className={`absolute flex items-center gap-1.5 px-2.5 rounded-md border text-left transition-colors
            ${s.fuenteId
              ? 'border-digi-border bg-digi-card hover:border-accent hover:bg-accent-light cursor-pointer'
              : 'border-transparent bg-digi-darker/60 cursor-default'}`}
          style={{ left: s.x, top: s.y, width: s.ancho, height: s.alto }}
        >
          {(() => { const I = ICONOS[s.icono ?? ''] ?? FileText; return <I className={`w-3.5 h-3.5 shrink-0 ${s.fuenteId ? 'text-digi-muted' : 'text-digi-muted/60'}`} />; })()}
          <span className="min-w-0">
            <span className="block text-[11.5px] font-medium text-digi-text truncate" style={mf}>{s.label}</span>
            {s.sublabel && <span className="block text-[10px] text-digi-muted truncate leading-tight" style={mf}>{s.sublabel}</span>}
          </span>
        </button>
      ))}

      {/* ── La tarjeta ── */}
      <div
        className={`rounded-lg border bg-digi-card px-3 py-2.5 flex items-center gap-2.5 transition-all
          ${seleccionado ? 'border-accent ring-2 ring-accent/25 shadow-md' : 'border-digi-border hover:border-accent/50'}
          ${esCondicion ? 'border-dashed' : ''}`}
        style={{ width: t.ancho, height: t.alto }}
      >
        <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${acento.borde} ${acento.fondo}`}>
          <Icono className={`w-4 h-4 ${acento.texto}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block text-[12.5px] font-semibold text-digi-text truncate" style={mf}>{nodo.label}</span>
            {/* Marcar los pasos con IA importa: son los que cuestan dinero, tardan y pueden
                variar entre corridas. Hay que distinguirlos de un vistazo. */}
            {esIA && (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 rounded-full border border-accent/40 bg-accent-light text-accent text-[9.5px] font-bold uppercase tracking-wide" style={mf}>
                <Sparkles className="w-2.5 h-2.5" /> IA
              </span>
            )}
          </span>
          {nodo.sublabel && <span className="block text-[11px] text-digi-muted truncate leading-tight mt-0.5" style={mf}>{nodo.sublabel}</span>}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
}

function NodoGrupo({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div className="w-full h-full rounded-xl border border-dashed border-digi-border bg-digi-darker/30">
      <span className="absolute top-4 left-5 text-[11px] font-semibold uppercase tracking-wider text-digi-muted" style={mf}>
        {data.label}
      </span>
    </div>
  );
}

/* ═══════════════════════ ARISTA ═══════════════════════ */

/** Redondea las esquinas de una polilínea ortogonal. */
function trazo(puntos: { x: number; y: number }[], radio = 8): string {
  if (puntos.length < 2) return '';
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 1; i < puntos.length - 1; i++) {
    const a = puntos[i - 1], b = puntos[i], c = puntos[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radio, l1 / 2, l2 / 2);
    if (r < 1) { d += ` L ${b.x},${b.y}`; continue; }
    const p1 = { x: b.x + ((a.x - b.x) / l1) * r, y: b.y + ((a.y - b.y) / l1) * r };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * r, y: b.y + ((c.y - b.y) / l2) * r };
    d += ` L ${p1.x},${p1.y} Q ${b.x},${b.y} ${p2.x},${p2.y}`;
  }
  const f = puntos[puntos.length - 1];
  return `${d} L ${f.x},${f.y}`;
}

interface DatosArista extends Record<string, unknown> {
  puntos: { x: number; y: number }[];
  etiqueta?: string;
  variante?: 'normal' | 'alterna';
}

function AristaElk({ id, data, markerEnd }: EdgeProps<Edge<DatosArista>>) {
  const puntos = data?.puntos ?? [];
  if (puntos.length < 2) return null;
  const alterna = data?.variante === 'alterna';
  const medio = puntos[Math.floor(puntos.length / 2)];

  return (
    <>
      <path
        id={id}
        d={trazo(puntos)}
        fill="none"
        stroke={alterna ? 'var(--color-digi-muted)' : 'var(--color-accent)'}
        strokeWidth={alterna ? 1.4 : 1.8}
        strokeDasharray={alterna ? '5 4' : undefined}
        markerEnd={markerEnd}
        opacity={alterna ? 0.7 : 1}
      />
      {data?.etiqueta && (
        <EdgeLabelRenderer>
          {/* Sobre pastilla OPACA: sin fondo, la línea atraviesa el texto y queda tachado. */}
          <div
            className="absolute px-1.5 py-0.5 rounded border border-digi-border bg-digi-card text-[10px] font-medium text-digi-muted pointer-events-none"
            style={{ ...mf, transform: `translate(-50%,-50%) translate(${medio.x}px, ${medio.y}px)` }}
          >
            {data.etiqueta}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const TIPOS_NODO = { paso: NodoPaso, grupo: NodoGrupo };
const TIPOS_ARISTA = { elk: AristaElk };

/* ═══════════════════════ LIENZO ═══════════════════════ */

interface Props {
  pipeline: Pipeline;
  nodoSel: string | null;
  alSeleccionarNodo: (id: string) => void;
  alSeleccionarFuente: (id: string) => void;
  atajos?: React.ReactNode;
}

function Lienzo({ pipeline, nodoSel, alSeleccionarNodo, alSeleccionarFuente, atajos }: Props) {
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const { setCenter, getZoom } = useReactFlow();
  const posiciones = useRef(new Map<string, { x: number; y: number; ancho: number; alto: number }>());

  /**
   * La firma incluye SOLO lo que cambia la colocación. Sin esto, seleccionar un paso
   * recalcularía el layout entero y el lienzo daría un salto en cada clic.
   */
  const firma = useMemo(
    () => JSON.stringify([
      pipeline.nodos.map((n) => [n.id, n.tipo, n.grupo, JSON.stringify(n.satelites ?? [])]),
      pipeline.aristas.map((a) => [a.desde, a.hacia]),
    ]),
    [pipeline],
  );

  useEffect(() => {
    let vivo = true;
    colocarPipeline(pipeline).then((c) => { if (vivo) setColocacion(c); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const { nodos, aristas } = useMemo(() => {
    if (!colocacion) return { nodos: [] as Node[], aristas: [] as Edge[] };
    posiciones.current.clear();

    const nodosGrupo: Node[] = colocacion.grupos.map((g) => ({
      id: g.id, type: 'grupo', position: { x: g.x, y: g.y },
      data: { label: g.label },
      // El tamaño se fija explícitamente y es el MISMO que se le dio a ELK. Si se deja
      // medir al DOM, la tarjeta se encoge a su contenido y las posiciones dejan de cuadrar.
      style: { width: g.ancho, height: g.alto },
      selectable: false, draggable: false, zIndex: 0,
    }));

    const nodosPaso: Node[] = colocacion.nodos.map((p) => {
      const nodo = pipeline.nodos.find((n) => n.id === p.id)!;
      const t = TAMANO[nodo.tipo];
      const grupo = colocacion.grupos.find((g) => g.id === p.padre);
      posiciones.current.set(p.id, {
        x: (grupo?.x ?? 0) + p.x, y: (grupo?.y ?? 0) + p.y, ancho: t.ancho, alto: t.alto,
      });
      return {
        id: p.id, type: 'paso', position: { x: p.x, y: p.y }, parentId: p.padre,
        extent: undefined,
        data: {
          nodo,
          satelites: colocarSatelites(nodo.satelites, t.ancho, t.alto),
          seleccionado: nodoSel === p.id,
          alSeleccionarFuente,
        } satisfies DatosPaso,
        style: { width: p.ancho, height: p.alto },
        draggable: false, zIndex: 1,
      };
    });

    const e: Edge[] = colocacion.aristas.map((a) => ({
      id: a.id, source: a.desde, target: a.hacia, type: 'elk',
      data: { puntos: a.puntos, etiqueta: a.etiqueta, variante: a.variante } satisfies DatosArista,
      selectable: false, focusable: false, zIndex: 2,
    }));

    // ⚠️ Los contenedores ANTES que sus hijos: React Flow exige que el padre ya exista en
    // el array cuando aparece un nodo con `parentId`.
    return { nodos: [...nodosGrupo, ...nodosPaso], aristas: e };
  }, [colocacion, pipeline.nodos, nodoSel, alSeleccionarFuente]);

  /**
   * Al pulsar un nodo, la vista VIAJA hasta él y lo deja centrado. Es lo que hace que
   * recorrer un diagrama largo se sienta continuo en vez de a saltos.
   */
  const centrarEn = useCallback((id: string) => {
    const p = posiciones.current.get(id);
    if (!p) return;
    setCenter(p.x + p.ancho / 2, p.y + p.alto / 2, {
      zoom: Math.max(getZoom(), 0.85),
      duration: 520,
    });
  }, [setCenter, getZoom]);

  const alPulsarNodo = useCallback((_: unknown, n: Node) => {
    if (n.type !== 'paso') return;
    alSeleccionarNodo(n.id);
    centrarEn(n.id);
  }, [alSeleccionarNodo, centrarEn]);

  // Cuando la selección viene de FUERA (un atajo, el panel), también se viaja hasta ella.
  useEffect(() => {
    if (nodoSel && colocacion) centrarEn(nodoSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodoSel, colocacion]);

  // ⚠️ NO montar React Flow con 0 nodos: ELK es asíncrono y su `fitView` correría en
  // vacío y no volvería a encuadrar.
  if (!colocacion) {
    return (
      <div className="h-full flex items-center justify-center text-[12.5px] text-digi-muted" style={mf}>
        Dibujando el flujo…
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodos}
      edges={aristas}
      nodeTypes={TIPOS_NODO}
      edgeTypes={TIPOS_ARISTA}
      onNodeClick={alPulsarNodo}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={1.4}
      elementsSelectable
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      zoomOnScroll={false}
      panOnScroll
      panOnDrag
      zoomOnDoubleClick={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--color-digi-border)" />
      <Controls showInteractive={false} position="bottom-right" />
      {atajos && <Panel position="bottom-left">{atajos}</Panel>}
    </ReactFlow>
  );
}

export function PipelineFlow(props: Props) {
  return (
    <ReactFlowProvider>
      <Lienzo {...props} />
    </ReactFlowProvider>
  );
}
