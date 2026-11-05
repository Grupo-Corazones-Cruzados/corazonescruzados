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
import type { ClaseConexion, Colocacion, DocFlujo, NodoFlujo, Punto } from './colocar';
import { TAMANO } from './colocar';
import { PIEZAS } from './piezas';

const COLOR_CONEXION: Record<ClaseConexion, { color: string; discontinua?: boolean }> = {
  normal: { color: 'var(--color-digi-muted)' },
  si: { color: 'var(--color-green-400)' },
  no: { color: 'var(--color-red-400)' },
  repite: { color: 'var(--color-blue-400)', discontinua: true },
  error: { color: 'var(--color-red-400)', discontinua: true },
};

/** Lo que pasa de un rol a otro es lo que más interesa ver: destaca con el color de la marca. */
const colorDe = (clase: ClaseConexion, entrega: boolean) => (entrega && clase === 'normal' ? 'var(--color-accent)' : COLOR_CONEXION[clase].color);

const ETIQUETA_CLASE: Partial<Record<ClaseConexion, string>> = { si: 'Sí', no: 'No' };
const ZOOM_LECTURA = 0.8;

interface DatosNodo extends Record<string, unknown> { nodo: NodoFlujo; atenuado: boolean; elegido: boolean }
interface DatosRol extends Record<string, unknown> { nombre: string; cuenta: number; atenuado: boolean; ancho: number; alto: number }
interface DatosArista extends Record<string, unknown> { puntos: Punto[]; clase: ClaseConexion; etiqueta?: string; atenuada: boolean; entrega: boolean }

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
  const { discontinua } = COLOR_CONEXION[data.clase];
  const color = colorDe(data.clase, data.entrega);
  const texto = data.etiqueta || ETIQUETA_CLASE[data.clase];
  // La etiqueta va en el primer tramo: en medio de una línea larga no se sabe de qué salida es.
  const [a, b] = data.puntos;
  const sitio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return (
    <>
      <path id={id} d={trazo(data.puntos)} fill="none" stroke={color} strokeWidth={data.entrega ? 2 : 1.5} strokeDasharray={discontinua ? '5 4' : undefined} markerEnd={markerEnd} opacity={data.atenuada ? 0.12 : 1} className="transition-opacity duration-200" />
      {texto && !data.atenuada && (
        <EdgeLabelRenderer>
          {/* Fondo opaco: sin él, la línea atraviesa el texto y queda tachado. */}
          <span className="absolute px-1 max-w-[150px] truncate bg-digi-card text-[10.5px] leading-[14px] pointer-events-none" style={{ color, transform: `translate(-50%,-50%) translate(${sitio.x}px,${sitio.y}px)` }}>{texto}</span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const TIPOS = { diagrama: NodoDiagrama, rol: NodoRol };
const ARISTAS = { conexion: Conexion };

/** Junto al nodo elegido, sigue a la vista al desplazarse y nunca se sale del lienzo. */
function Burbuja({ nodo, caja, rol, marco }: { nodo: NodoFlujo; caja: { x: number; y: number; ancho: number; alto: number }; rol: string; marco: { ancho: number; alto: number } }) {
  const [tx, ty, zoom] = useStore((s) => s.transform);
  const ref = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => { setAlto(ref.current?.offsetHeight ?? 0); }, [nodo.id, marco.ancho]);
  useEffect(() => { const r = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(r); }, []);

  const ancho = Math.min(280, marco.ancho - 24);
  const centroX = (caja.x + caja.ancho / 2) * zoom + tx;
  const arriba = caja.y * zoom + ty;
  const abajo = (caja.y + caja.alto) * zoom + ty;
  // Si el nodo ya salió del lienzo, señalar a la nada no ayuda.
  if (abajo < 0 || arriba > marco.alto || centroX < -caja.ancho * zoom / 2 || centroX > marco.ancho + caja.ancho * zoom / 2) return null;
  const debajo = abajo + 10 + alto + 8 <= marco.alto || arriba - 10 - alto < 8;
  const left = Math.max(12, Math.min(marco.ancho - ancho - 12, centroX - ancho / 2));
  const top = debajo ? abajo + 10 : arriba - 10 - alto;
  const pieza = PIEZAS[nodo.tipo];
  return (
    <div ref={ref} role="status" aria-label={`Detalle de ${nodo.titulo}`} data-burbuja-flujo
      className={`absolute z-10 pointer-events-none rounded-lg border border-digi-border bg-digi-card p-3 shadow-lg transition-opacity duration-200 ${visible && alto ? 'opacity-100' : 'opacity-0'}`}
      style={{ left, top, width: ancho }}>
      <span aria-hidden className={`absolute w-2.5 h-2.5 rotate-45 bg-digi-card border-digi-border ${debajo ? '-top-[6px] border-l border-t' : '-bottom-[6px] border-r border-b'}`}
        style={{ left: Math.max(10, Math.min(ancho - 20, centroX - left - 5)) }} />
      <p className="flex items-center gap-1.5 text-[11px] text-digi-muted min-w-0">
        <pieza.Icono className={`shrink-0 w-3.5 h-3.5 ${pieza.texto}`} />
        <span className="truncate">{TIPOS_NODO[nodo.tipo].nombre} · {rol}</span>
      </p>
      <p className="mt-1 text-[13px] font-medium leading-[18px] text-digi-text">{nodo.titulo}</p>
      <p className="mt-1 text-[12.5px] leading-[18px] text-digi-text">{nodo.descripcion}</p>
      <p className="mt-1.5 text-[11px] font-mono text-digi-muted break-all">{nodo.origen}</p>
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
        data: { nodo: n, atenuado: !!rol && rol !== n.rol, elegido: elegido === n.id },
      }];
    });
    return [...roles, ...propios];
  }, [doc, colocacion, rol, elegido]);

  const aristas = useMemo<Edge[]>(() => colocacion.aristas.map((a) => {
    const atenuada = !!rol && nodoDe.get(a.de)?.rol !== rol && nodoDe.get(a.a)?.rol !== rol;
    return {
      id: a.id, source: a.de, target: a.a, type: 'conexion', focusable: false, selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: atenuada ? 'transparent' : colorDe(a.clase, a.entrega) },
      data: { puntos: a.puntos, clase: a.clase, etiqueta: a.etiqueta, atenuada, entrega: a.entrega },
    };
  }), [colocacion, rol, nodoDe]);

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

  const elegir = useCallback((_: unknown, n: Node) => {
    if (n.type !== 'diagrama') return;
    alElegir(n.id);
    const c = colocacion.absolutos.get(n.id);
    if (!c) return;
    // El nodo queda en el tercio de arriba, para que la burbuja quepa debajo.
    const zoom = Math.max(flujo.getZoom(), amplio ? 0.5 : ZOOM_LECTURA);
    flujo.setCenter(c.x + c.ancho / 2, c.y + c.alto / 2 + (marco.alto * 0.2) / zoom, { zoom, duration: 300 });
  }, [alElegir, colocacion, flujo, marco.alto, amplio]);

  const alTerminarMover = useCallback((_: unknown, v: Viewport) => {
    if (!marco.ancho) return;
    alMover({ x: (marco.ancho / 2 - v.x) / v.zoom, y: (marco.alto / 2 - v.y) / v.zoom, zoom: v.zoom });
  }, [alMover, marco]);

  const nodoElegido = elegido ? nodoDe.get(elegido) : undefined;
  const cajaElegida = elegido ? colocacion.absolutos.get(elegido) : undefined;

  return (
    <div ref={marcoRef} className="relative w-full h-full overflow-hidden" data-lienzo-flujo>
      <ReactFlow
        id={amplio ? 'flujo-amplio' : 'flujo-panel'}
        nodes={nodos} edges={aristas} nodeTypes={TIPOS} edgeTypes={ARISTAS}
        onNodeClick={elegir} onPaneClick={() => alElegir(null)} onMoveEnd={alTerminarMover}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable edgesFocusable={false}
        panOnDrag panOnScroll zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false}
        minZoom={0.05} maxZoom={1.75} onlyRenderVisibleElements proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--color-digi-border)" />
        <Controls showInteractive={false} position="bottom-left" fitViewOptions={{ padding: 0.04, duration: 300 }} aria-label="Acercar y alejar" />
        {amplio && grande && (
          <MiniMap pannable zoomable position="bottom-right" ariaLabel="Mapa del diagrama" bgColor="var(--color-digi-card)" maskColor="rgba(128,128,128,.25)" nodeColor={(n) => (n.type === 'rol' ? 'var(--color-digi-darker)' : 'var(--color-digi-muted)')} nodeStrokeColor="var(--color-digi-border)" />
        )}
      </ReactFlow>
      {nodoElegido && cajaElegida && <Burbuja key={nodoElegido.id} nodo={nodoElegido} caja={cajaElegida} rol={nombreRol.get(nodoElegido.rol) ?? ''} marco={marco} />}
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
