'use client';

/**
 * EL LIENZO DEL DIAGRAMA, que se recorre como una pizarra.
 *
 * Es un visor: el flujo lo cambia el código, así que los nodos no se arrastran ni se conectan.
 * · `elementsSelectable` TIENE que estar activo: React Flow le pone `pointer-events: none` a un nodo que no es
 *   seleccionable ni arrastrable ni conectable, y entonces no recibe el clic.
 * · Dos dedos o la rueda recorren; pellizcar y los botones acercan; arrastrar el fondo también recorre.
 *
 * Se carga con `dynamic(..., { ssr: false })`: React Flow solo baja si hay un diagrama que mostrar.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Background, BackgroundVariant, Controls, EdgeLabelRenderer, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore,
  type Edge, type EdgeProps, type Node, type NodeProps, type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PANTALLA_LG, useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { TIPOS_NODO } from '@/services/espacio-trabajo/flujo-catalogo.mjs';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ClaseConexion, Colocacion, Conector, DocFlujo, NodoFlujo, Punto } from './colocar';
import { TAMANO, TAMANO_CONECTOR } from './colocar';
import { PIEZAS } from './piezas';

const COLOR_CONEXION: Record<ClaseConexion, { color: string; discontinua?: boolean }> = {
  normal: { color: 'var(--color-digi-muted)' },
  si: { color: 'var(--color-green-400)' },
  no: { color: 'var(--color-red-400)' },
  repite: { color: 'var(--color-blue-400)', discontinua: true },
  error: { color: 'var(--color-red-400)', discontinua: true },
};

const ETIQUETA_CLASE: Partial<Record<ClaseConexion, string>> = { si: 'Sí', no: 'No' };
const ZOOM_LECTURA = 0.8;

interface DatosNodo extends Record<string, unknown> { nodo: NodoFlujo; atenuado: boolean; elegido: boolean }
interface DatosRol extends Record<string, unknown> { nombre: string; cuenta: number; atenuado: boolean; ancho: number; alto: number }
interface DatosConector extends Record<string, unknown> { conector: Conector; texto: string; detalle: string; atenuado: boolean }
interface DatosArista extends Record<string, unknown> { puntos: Punto[]; clase: ClaseConexion; etiqueta?: string; atenuada: boolean; resaltada: boolean }

const ASA = '!opacity-0 !w-px !h-px !min-w-0 !min-h-0 !border-0 !pointer-events-none';

const NodoDiagrama = memo(function NodoDiagrama({ data }: NodeProps<Node<DatosNodo>>) {
  const { nodo, atenuado, elegido } = data;
  const pieza = PIEZAS[nodo.tipo];
  const t = TAMANO[nodo.tipo];
  const clase = `transition-opacity duration-200 ${atenuado ? 'opacity-20' : ''}`;
  const asas = (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} className={ASA} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className={ASA} />
    </>
  );
  if (nodo.tipo === 'decision') {
    return (
      <div className={`relative ${clase}`} style={{ width: t.ancho, height: t.alto }}>
        {asas}
        <svg aria-hidden className={`absolute inset-0 ${pieza.texto}`} width={t.ancho} height={t.alto} viewBox={`0 0 ${t.ancho} ${t.alto}`}>
          <polygon points={`${t.ancho / 2},1 ${t.ancho - 1},${t.alto / 2} ${t.ancho / 2},${t.alto - 1} 1,${t.alto / 2}`} fill="var(--color-digi-card)" stroke={elegido ? 'var(--color-accent)' : 'currentColor'} strokeWidth={elegido ? 3 : 1.5} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center px-[52px]">
          <span className="text-[11.5px] leading-[15px] text-center text-digi-text line-clamp-3 break-words">{nodo.titulo}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 px-3 border bg-digi-card ${elegido ? 'border-accent ring-2 ring-accent' : pieza.borde} ${clase}`} style={{ width: t.ancho, height: t.alto, borderRadius: pieza.radio }}>
      {asas}
      <pieza.Icono className={`shrink-0 w-4 h-4 ${pieza.texto}`} />
      <span className="min-w-0 text-[12px] leading-4 text-digi-text line-clamp-3 break-words">{nodo.titulo}</span>
    </div>
  );
});

/** Una conexión que sigue en otro rol. Dice a dónde va y, al pulsarla, lleva hasta allí. */
const NodoConector = memo(function NodoConector({ data }: NodeProps<Node<DatosConector>>) {
  const Flecha = data.conector.sentido === 'sale' ? ArrowUpRight : ArrowDownRight;
  return (
    <div title={data.detalle} className={`flex items-center gap-1.5 px-2 border border-dashed border-accent bg-digi-card cursor-pointer transition-opacity duration-200 ${data.atenuado ? 'opacity-20' : ''}`} style={{ width: TAMANO_CONECTOR.ancho, height: TAMANO_CONECTOR.alto, borderRadius: 6 }}>
      <Handle type="target" position={Position.Top} isConnectable={false} className={ASA} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className={ASA} />
      <Flecha className="shrink-0 w-3.5 h-3.5 text-accent" />
      <span className="min-w-0 text-[11px] leading-[14px] text-accent line-clamp-2 break-words">{data.texto}</span>
    </div>
  );
});

function NodoRol({ data }: NodeProps<Node<DatosRol>>) {
  return (
    <div className={`rounded-xl border border-digi-border bg-digi-darker transition-opacity duration-200 ${data.atenuado ? 'opacity-30' : ''}`} style={{ width: data.ancho, height: data.alto }}>
      <p className="px-5 pt-4 text-[15px] font-semibold text-digi-text">{data.nombre} <span className="font-normal text-digi-muted tabular-nums">{data.cuenta}</span></p>
    </div>
  );
}

/** Redondea las esquinas de una línea con tramos rectos. */
function trazo(p: Punto[], radio = 8) {
  let d = `M ${p[0].x},${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radio, l1 / 2, l2 / 2);
    if (r < 1) { d += ` L ${b.x},${b.y}`; continue; }
    d += ` L ${b.x + ((a.x - b.x) / l1) * r},${b.y + ((a.y - b.y) / l1) * r} Q ${b.x},${b.y} ${b.x + ((c.x - b.x) / l2) * r},${b.y + ((c.y - b.y) / l2) * r}`;
  }
  const f = p[p.length - 1];
  return `${d} L ${f.x},${f.y}`;
}

function Conexion({ id, data, markerEnd }: EdgeProps<Edge<DatosArista>>) {
  if (!data) return null;
  const { color, discontinua } = COLOR_CONEXION[data.clase];
  const texto = data.etiqueta || ETIQUETA_CLASE[data.clase];
  const d = trazo(data.puntos);
  // La etiqueta va en el primer tramo: en medio de una línea larga no se sabe de qué salida es.
  const [a, b] = data.puntos;
  const sitio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <g className="group">
      {/* Más ancha que la línea e invisible: atinarle a 1,5 px no es razonable. */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" />
      <path id={id} d={d} fill="none" stroke={color} strokeWidth={data.resaltada ? 2.75 : 1.5} strokeDasharray={discontinua ? '5 4' : undefined} markerEnd={markerEnd} opacity={data.atenuada ? 0.1 : 1} className="pointer-events-none transition-opacity duration-200 group-hover:[stroke-width:3]" />
      {texto && !data.atenuada && (
        <EdgeLabelRenderer>
          {/* Fondo opaco: sin él, la línea atraviesa el texto y queda tachado. */}
          <span className="absolute px-1 max-w-[150px] truncate bg-digi-card text-[10.5px] leading-[14px] pointer-events-none" style={{ color, transform: `translate(-50%,-50%) translate(${sitio.x}px,${sitio.y}px)` }}>{texto}</span>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}

const TIPOS = { diagrama: NodoDiagrama, rol: NodoRol, conector: NodoConector };
const ARISTAS = { conexion: Conexion };

interface Vecino { id: string; titulo: string; rol: string | null; etiqueta?: string }

function ListaVecinos({ titulo, vecinos, alIr, Flecha }: { titulo: string; vecinos: Vecino[]; alIr: (id: string) => void; Flecha: typeof ArrowUpRight }) {
  if (!vecinos.length) return null;
  return (
    <div className="mt-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">{titulo}</p>
      {vecinos.map((v) => (
        <button key={v.id} type="button" onClick={() => alIr(v.id)} title={v.titulo} className="w-full flex items-start gap-1 py-0.5 text-left text-[12px] leading-4 text-accent hover:underline">
          <Flecha className="shrink-0 w-3.5 h-3.5 mt-px" />
          <span className="min-w-0">{v.rol && <span className="font-medium">{v.rol}: </span>}{v.titulo}{v.etiqueta && <span className="text-digi-muted"> · {v.etiqueta}</span>}</span>
        </button>
      ))}
    </div>
  );
}

/** Junto al nodo elegido, sigue a la vista al desplazarse y nunca se sale del lienzo. Solo sus enlaces reciben el puntero. */
function Burbuja({ nodo, caja, rol, marco, salidas, entradas, alIr }: { nodo: NodoFlujo; caja: { x: number; y: number; ancho: number; alto: number }; rol: string; marco: { ancho: number; alto: number }; salidas: Vecino[]; entradas: Vecino[]; alIr: (id: string) => void }) {
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const ref = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => { setAlto(ref.current?.offsetHeight ?? 0); }, [nodo.id, marco.ancho, marco.alto]);
  useEffect(() => { const r = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(r); }, []);

  const ancho = Math.min(300, marco.ancho - 24);
  const centroX = (caja.x + caja.ancho / 2) * zoom + tx;
  const arriba = caja.y * zoom + ty;
  const abajo = (caja.y + caja.alto) * zoom + ty;
  // Si el nodo ya salió del lienzo, señalar a la nada no ayuda.
  if (abajo < 0 || arriba > marco.alto || centroX < -caja.ancho * zoom / 2 || centroX > marco.ancho + caja.ancho * zoom / 2) return null;
  const debajo = abajo + 10 + alto + 8 <= marco.alto || arriba - 10 - alto < 8;
  const left = Math.max(12, Math.min(marco.ancho - ancho - 12, centroX - ancho / 2));
  const top = Math.max(8, Math.min(marco.alto - alto - 8, debajo ? abajo + 10 : arriba - 10 - alto));
  const pieza = PIEZAS[nodo.tipo];
  return (
    <div ref={ref} role="status" aria-label={`Detalle de ${nodo.titulo}`} data-burbuja-flujo
      className={`absolute z-10 pointer-events-none flex flex-col rounded-lg border border-digi-border bg-digi-card p-3 shadow-lg transition-opacity duration-200 ${visible && alto ? 'opacity-100' : 'opacity-0'}`}
      style={{ left, top, width: ancho, maxHeight: marco.alto - 16 }}>
      <span aria-hidden className={`absolute w-2.5 h-2.5 rotate-45 bg-digi-card border-digi-border ${debajo ? '-top-[6px] border-l border-t' : '-bottom-[6px] border-r border-b'}`}
        style={{ left: Math.max(10, Math.min(ancho - 20, centroX - left - 5)) }} />
      <p className="shrink-0 flex items-center gap-1.5 text-[11px] text-digi-muted min-w-0">
        <pieza.Icono className={`shrink-0 w-3.5 h-3.5 ${pieza.texto}`} />
        <span className="truncate">{TIPOS_NODO[nodo.tipo].nombre} · {rol}</span>
      </p>
      <div className="min-h-0 overflow-y-auto pointer-events-auto">
        <p className="mt-1 text-[13px] font-medium leading-[18px] text-digi-text">{nodo.titulo}</p>
        <p className="mt-1 text-[12.5px] leading-[18px] text-digi-text">{nodo.descripcion}</p>
        <p className="mt-1.5 text-[11px] font-mono text-digi-muted break-all">{nodo.origen}</p>
        <ListaVecinos titulo="Va a" vecinos={salidas} alIr={alIr} Flecha={ArrowUpRight} />
        <ListaVecinos titulo="Viene de" vecinos={entradas} alIr={alIr} Flecha={ArrowDownRight} />
      </div>
    </div>
  );
}

export interface VistaLienzo { x: number; y: number; zoom: number }

function Interior({ doc, colocacion, elegido, alElegir, rol, vista, alMover, amplio }: LienzoProps) {
  const flujo = useReactFlow();
  // En el teléfono, el mapa taparía el lienzo y el diagrama entero no se leería.
  const grande = useConsultaMedia(PANTALLA_LG);
  const marcoRef = useRef<HTMLDivElement>(null);
  const [marco, setMarco] = useState({ ancho: 0, alto: 0 });

  useLayoutEffect(() => {
    const el = marcoRef.current;
    if (!el) return;
    const medir = () => setMarco({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const nombreRol = useMemo(() => new Map(doc.roles.map((r) => [r.id, r.nombre])), [doc]);
  const nodoDe = useMemo(() => new Map(doc.nodos.map((n) => [n.id, n])), [doc]);

  /* Con un nodo elegido, solo queda a la vista lo suyo: así se ve de dónde viene y a dónde va cada línea. */
  const relacionados = useMemo(() => {
    if (!elegido) return null;
    const ids = new Set<string>([elegido]);
    for (const c of doc.conexiones) {
      if (c.de === elegido) ids.add(c.a);
      if (c.a === elegido) ids.add(c.de);
    }
    for (const c of colocacion.conectores.values()) if (c.nodo === elegido) ids.add(c.id);
    return ids;
  }, [elegido, doc, colocacion]);

  const nodos = useMemo<Node[]>(() => {
    const roles: Node[] = doc.roles.flatMap((r) => {
      const c = colocacion.roles.get(r.id);
      if (!c) return [];
      return [{
        id: `rol:${r.id}`, type: 'rol', position: { x: c.x, y: c.y }, width: c.ancho, height: c.alto, selectable: false, focusable: false,
        data: { nombre: r.nombre, cuenta: doc.nodos.filter((n) => n.rol === r.id).length, atenuado: !!rol && rol !== r.id, ancho: c.ancho, alto: c.alto },
      }];
    });
    const propios: Node[] = doc.nodos.flatMap((n) => {
      const c = colocacion.nodos.get(n.id);
      if (!c) return [];
      return [{
        id: n.id, type: 'diagrama', parentId: `rol:${n.rol}`, position: { x: c.x, y: c.y }, width: c.ancho, height: c.alto,
        data: { nodo: n, atenuado: (!!rol && rol !== n.rol) || (!!relacionados && !relacionados.has(n.id)), elegido: elegido === n.id },
      }];
    });
    const conectores: Node[] = [...colocacion.conectores.values()].flatMap((k) => {
      const c = colocacion.nodos.get(k.id);
      if (!c) return [];
      const destino = nombreRol.get(k.rolOtro) ?? '';
      const titulos = k.otros.map((o) => nodoDe.get(o)?.titulo ?? o);
      return [{
        id: k.id, type: 'conector', parentId: `rol:${k.rol}`, position: { x: c.x, y: c.y }, width: c.ancho, height: c.alto,
        data: {
          conector: k, detalle: `${k.sentido === 'sale' ? 'Sigue en' : 'Viene de'} ${destino}: ${titulos.join(' · ')}`,
          texto: k.otros.length === 1 ? `${destino}: ${titulos[0]}` : `${destino} · ${k.otros.length} ${k.sentido === 'sale' ? 'destinos' : 'orígenes'}`,
          atenuado: (!!rol && rol !== k.rol) || (!!relacionados && !relacionados.has(k.id)),
        },
      }];
    });
    return [...roles, ...propios, ...conectores];
  }, [doc, colocacion, rol, elegido, relacionados, nombreRol, nodoDe]);

  const aristas = useMemo<Edge[]>(() => colocacion.aristas.map((a) => {
    const rolDe = (id: string) => nodoDe.get(id)?.rol ?? colocacion.conectores.get(id)?.rol;
    const resaltada = !!elegido && (a.de === elegido || a.a === elegido);
    const atenuada = (!!rol && rolDe(a.de) !== rol) || (!!elegido && !resaltada);
    return {
      id: a.id, source: a.de, target: a.a, type: 'conexion', focusable: false, selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: atenuada ? 'transparent' : COLOR_CONEXION[a.clase].color },
      data: { puntos: a.puntos, clase: a.clase, etiqueta: a.etiqueta, atenuada, resaltada },
    };
  }), [colocacion, rol, nodoDe, elegido]);

  /* Al llegar: donde se dejó, o en la primera entrada a tamaño legible. Encoger todo el diagrama a 320 px no se leería. */
  const colocada = useRef(false);
  useEffect(() => {
    if (colocada.current || !marco.ancho) return;
    colocada.current = true;
    if (vista) { flujo.setCenter(vista.x, vista.y, { zoom: vista.zoom, duration: 0 }); return; }
    if (amplio && grande) { flujo.fitView({ padding: 0.04, duration: 0 }); return; }
    const primero = doc.nodos.find((n) => n.tipo === 'inicio' && (!rol || n.rol === rol)) ?? doc.nodos[0];
    const c = colocacion.absolutos.get(primero.id);
    if (c) flujo.setCenter(c.x + c.ancho / 2, c.y + marco.alto * 0.3 / ZOOM_LECTURA, { zoom: ZOOM_LECTURA, duration: 0 });
  }, [marco.ancho, marco.alto, vista, flujo, doc, colocacion, rol, amplio, grande]);

  /* Elegir un rol lleva la vista hasta él. */
  const rolAnterior = useRef(rol);
  useEffect(() => {
    if (rolAnterior.current === rol) return;
    rolAnterior.current = rol;
    const c = rol ? colocacion.roles.get(rol) : null;
    if (c) flujo.fitBounds({ x: c.x, y: c.y, width: c.ancho, height: c.alto }, { padding: 0.06, duration: 300 });
    else flujo.fitView({ padding: 0.04, duration: 300 });
  }, [rol, colocacion, flujo]);

  /** Elige un nodo y lleva la vista hasta él: queda en el tercio de arriba, para que la burbuja quepa debajo. */
  const irA = useCallback((id: string) => {
    alElegir(id);
    const c = colocacion.absolutos.get(id);
    if (!c) return;
    const zoom = Math.max(flujo.getZoom(), amplio ? 0.5 : ZOOM_LECTURA);
    flujo.setCenter(c.x + c.ancho / 2, c.y + c.alto / 2 + (marco.alto * 0.2) / zoom, { zoom, duration: 400 });
  }, [alElegir, colocacion, flujo, marco.alto, amplio]);

  /** Un conector lleva a su otro extremo. Si son varios, a su nodo, cuya burbuja los lista. */
  const seguir = useCallback((id: string) => {
    const k = colocacion.conectores.get(id);
    irA(k ? (k.otros.length === 1 ? k.otros[0] : k.nodo) : id);
  }, [colocacion, irA]);

  const alPulsarNodo = useCallback((_: unknown, n: Node) => { if (n.type !== 'rol') seguir(n.id); }, [seguir]);
  /* Pulsar una línea lleva a donde termina. */
  const alPulsarLinea = useCallback((_: unknown, e: Edge) => seguir(e.target), [seguir]);

  const alTerminarMover = useCallback((_: unknown, v: Viewport) => {
    if (!marco.ancho) return;
    alMover({ x: (marco.ancho / 2 - v.x) / v.zoom, y: (marco.alto / 2 - v.y) / v.zoom, zoom: v.zoom });
  }, [alMover, marco]);

  const nodoElegido = elegido ? nodoDe.get(elegido) : undefined;
  const cajaElegida = elegido ? colocacion.absolutos.get(elegido) : undefined;
  const vecinos = useMemo(() => {
    const salidas: Vecino[] = []; const entradas: Vecino[] = [];
    if (!nodoElegido) return { salidas, entradas };
    const vecino = (id: string, etiqueta?: string): Vecino => {
      const n = nodoDe.get(id);
      return { id, titulo: n?.titulo ?? id, rol: n && n.rol !== nodoElegido.rol ? nombreRol.get(n.rol) ?? null : null, etiqueta };
    };
    for (const c of doc.conexiones) {
      if (c.de === nodoElegido.id) salidas.push(vecino(c.a, c.etiqueta || ETIQUETA_CLASE[c.clase ?? 'normal']));
      if (c.a === nodoElegido.id) entradas.push(vecino(c.de, c.etiqueta));
    }
    return { salidas, entradas };
  }, [nodoElegido, doc, nodoDe, nombreRol]);

  return (
    <div ref={marcoRef} className="relative w-full h-full overflow-hidden" data-lienzo-flujo>
      <ReactFlow
        id={amplio ? 'flujo-amplio' : 'flujo-panel'}
        nodes={nodos} edges={aristas} nodeTypes={TIPOS} edgeTypes={ARISTAS}
        onNodeClick={alPulsarNodo} onEdgeClick={alPulsarLinea} onPaneClick={() => alElegir(null)} onMoveEnd={alTerminarMover}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable edgesFocusable={false}
        panOnDrag panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false}
        minZoom={0.05} maxZoom={1.75} onlyRenderVisibleElements proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--color-digi-border)" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ padding: 0.04, duration: 300 }} aria-label="Acercar y alejar" />
        {amplio && grande && (
          <MiniMap pannable zoomable position="bottom-right" ariaLabel="Mapa del diagrama" bgColor="var(--color-digi-card)" maskColor="rgba(128,128,128,.25)" nodeColor={(n) => (n.type === 'rol' ? 'var(--color-digi-darker)' : n.type === 'conector' ? 'var(--color-accent)' : 'var(--color-digi-muted)')} nodeStrokeColor="var(--color-digi-border)" />
        )}
      </ReactFlow>
      {nodoElegido && cajaElegida && <Burbuja key={nodoElegido.id} nodo={nodoElegido} caja={cajaElegida} rol={nombreRol.get(nodoElegido.rol) ?? ''} marco={marco} salidas={vecinos.salidas} entradas={vecinos.entradas} alIr={irA} />}
    </div>
  );
}

export interface LienzoProps {
  doc: DocFlujo;
  colocacion: Colocacion;
  elegido: string | null;
  alElegir: (id: string | null) => void;
  rol: string | null;
  /** Lo que se estaba mirando: al maximizar se sigue viendo lo mismo, y más. */
  vista: VistaLienzo | null;
  alMover: (v: VistaLienzo) => void;
  amplio: boolean;
}

export default function Lienzo(props: LienzoProps) {
  return <ReactFlowProvider><Interior {...props} /></ReactFlowProvider>;
}
