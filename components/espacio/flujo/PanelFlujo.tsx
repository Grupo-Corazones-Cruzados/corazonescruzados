'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, Workflow } from 'lucide-react';
import BotonCerrar from '@/components/ui/BotonCerrar';
import { BTN_ICONO_FILA, BTN_SECONDARY } from '@/components/ui/Button';
import { DURACION_APARICION, useAparicion } from '@/lib/hooks/useAparicion';
import { TIPOS_NODO } from '@/services/espacio-trabajo/flujo-catalogo.mjs';
import { api, hace, type Proyecto } from '../api';
import { colocar, type Colocacion, type DocFlujo, type TipoNodo } from './colocar';
import type { VistaLienzo } from './Lienzo';
import { PIEZA_CONECTOR, PIEZAS } from './piezas';

const Lienzo = dynamic(() => import('./Lienzo'), { ssr: false, loading: () => <Cargando /> });

const CADA_GENERANDO_MS = 4000;
const CADA_MS = 30000;

function Cargando() {
  return <div className="h-full flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-digi-muted" /></div>;
}

interface EstadoFlujo { flujo: DocFlujo | null; actualizado: number | null; sesion: string | null; generando: boolean }

function useFlujo(proyectoId: string | null) {
  const [estado, setEstado] = useState<EstadoFlujo | null>(null);
  const [error, setError] = useState('');
  const generando = !!estado?.generando;
  useEffect(() => { setEstado(null); setError(''); }, [proyectoId]);
  useEffect(() => {
    if (!proyectoId) return;
    let vivo = true;
    const traer = () => {
      if (document.visibilityState === 'hidden') return;
      api<EstadoFlujo>(`/proyectos/${proyectoId}/flujo`).then((j) => {
        if (!vivo) return;
        // Mientras no cambie la fecha, el diagrama es el mismo: no se recoloca ni se pierde lo que se mira.
        setEstado((a) => (a && a.actualizado === j.actualizado ? { ...a, sesion: j.sesion, generando: j.generando } : j));
        setError('');
      }).catch((e) => { if (vivo) setError(e.message); });
    };
    traer();
    const t = setInterval(traer, generando ? CADA_GENERANDO_MS : CADA_MS);
    document.addEventListener('visibilitychange', traer);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', traer); };
  }, [proyectoId, generando]);
  return { estado, error };
}

function Leyenda() {
  return (
    <div aria-label="Piezas del diagrama" className="hidden md:flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t border-digi-border">
      {(Object.keys(TIPOS_NODO) as TipoNodo[]).map((t) => {
        const { Icono, texto } = PIEZAS[t];
        return <span key={t} title={TIPOS_NODO[t].uso} className="inline-flex items-center gap-1.5 text-[11.5px] text-digi-muted"><Icono className={`w-3.5 h-3.5 ${texto}`} />{TIPOS_NODO[t].nombre}</span>;
      })}
      <span title={PIEZA_CONECTOR.uso} className="inline-flex items-center gap-1.5 text-[11.5px] text-digi-muted"><PIEZA_CONECTOR.Icono className="w-3.5 h-3.5 text-accent" />{PIEZA_CONECTOR.nombre}</span>
    </div>
  );
}

function SelectorRol({ doc, rol, alCambiar, className = '' }: { doc: DocFlujo; rol: string | null; alCambiar: (r: string | null) => void; className?: string }) {
  return (
    <select aria-label="Rol" value={rol ?? ''} onChange={(e) => alCambiar(e.target.value || null)}
      className={`select-compacto min-w-0 !text-[16px] lg:!h-7 lg:!min-h-0 lg:!text-[12px] ${className}`}>
      <option value="">Todos los roles</option>
      {doc.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
    </select>
  );
}

function Vacio({ proyecto, estado, error, alActualizar, alVerSesion }: {
  proyecto: Proyecto | null; estado: EstadoFlujo | null; error: string; alActualizar: (p: string) => void; alVerSesion: (p: string, s: string) => void;
}) {
  const caja = 'h-full flex flex-col items-center justify-center gap-2 px-4 text-center text-digi-muted';
  if (!proyecto) return <div className={caja}><Workflow className="w-5 h-5" /><p className="text-[12.5px]">Elige un proyecto</p></div>;
  if (error) return <div className={caja}><p className="text-[12.5px] text-red-400">{error}</p></div>;
  if (!estado) return <Cargando />;
  if (estado.generando && estado.sesion) {
    return (
      <div className={caja}>
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <p className="text-[12.5px]">Analizando el proyecto</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => alVerSesion(proyecto.id, estado.sesion!)}>Ver sesión</button>
      </div>
    );
  }
  return (
    <div className={caja}>
      <Workflow className="w-5 h-5" />
      <p className="text-[12.5px]">{estado.sesion ? 'La última sesión no publicó un diagrama' : 'Sin diagrama'}</p>
      <div className="flex items-center gap-2">
        {estado.sesion && <button type="button" className={BTN_SECONDARY} onClick={() => alVerSesion(proyecto.id, estado.sesion!)}>Ver sesión</button>}
        <button type="button" className={BTN_SECONDARY} onClick={() => alActualizar(proyecto.id)}>Generar diagrama</button>
      </div>
    </div>
  );
}

/**
 * EL DIAGRAMA DE FLUJO DEL PROYECTO. Tres formas según el sitio:
 * · `panel`: el recuadro de abajo a la derecha, que se maximiza a una ventana.
 * · `plegado`: un icono en la columna plegada, que abre la ventana.
 * · `ventana`: solo la ventana, abierta por quien la monta (teléfono).
 */
export default function PanelFlujo({ proyecto, forma, abierta, alCerrar, alActualizar, alVerSesion }: {
  proyecto: Proyecto | null;
  forma: 'panel' | 'plegado' | 'ventana';
  abierta?: boolean;
  alCerrar?: () => void;
  alActualizar: (proyecto: string) => void;
  alVerSesion: (proyecto: string, sesion: string) => void;
}) {
  const { estado, error } = useFlujo(proyecto?.id ?? null);
  const [colocacion, setColocacion] = useState<{ de: DocFlujo; es: Colocacion } | null>(null);
  const [errorColocar, setErrorColocar] = useState('');
  const [maximizado, setMaximizado] = useState(false);
  const [elegido, setElegido] = useState<string | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const vista = useRef<VistaLienzo | null>(null);

  useEffect(() => { setElegido(null); setRol(null); setMaximizado(false); vista.current = null; }, [proyecto?.id]);

  const doc = estado?.flujo ?? null;
  useEffect(() => {
    if (!doc) { setColocacion(null); return; }
    let vivo = true;
    setErrorColocar('');
    colocar(doc).then((es) => { if (vivo) { setColocacion({ de: doc, es }); setElegido(null); } }).catch((e) => { if (vivo) setErrorColocar(`No se pudo dibujar: ${e?.message || e}`); });
    return () => { vivo = false; };
  }, [doc]);

  const verVentana = forma === 'ventana' ? !!abierta : maximizado;
  const cerrarVentana = useCallback(() => { setMaximizado(false); alCerrar?.(); }, [alCerrar]);
  const { montado, visible } = useAparicion(verVentana);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (montado && dialogo.current && !dialogo.current.open) dialogo.current.showModal(); }, [montado]);

  const cambiarRol = useCallback((r: string | null) => { setRol(r); setElegido(null); }, []);
  const moverVista = useCallback((v: VistaLienzo) => { vista.current = v; }, []);
  const listo = !!doc && colocacion?.de === doc;
  const lienzo = (amplio: boolean) => (listo ? (
    <Lienzo doc={doc!} colocacion={colocacion!.es} elegido={elegido} alElegir={setElegido} rol={rol} vista={vista.current} alMover={moverVista} amplio={amplio} />
  ) : doc && !errorColocar ? <Cargando /> : errorColocar ? <p className="p-3 text-[12.5px] text-red-400">{errorColocar}</p> : (
    <Vacio proyecto={proyecto} estado={estado} error={error} alActualizar={alActualizar} alVerSesion={alVerSesion} />
  ));

  const marcaGenerando = estado?.generando && estado.sesion && proyecto && (
    <button type="button" onClick={() => alVerSesion(proyecto.id, estado.sesion!)} aria-label="Actualizándose: ver sesión" title="Actualizándose: ver sesión" className={BTN_ICONO_FILA}>
      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
    </button>
  );

  const ventana = montado && (
    <dialog ref={dialogo} aria-label={`Diagrama de flujo de ${proyecto?.nombre ?? ''}`}
      onCancel={(e) => { e.preventDefault(); if (elegido) setElegido(null); else cerrarVentana(); }}
      // Chrome cierra sin avisar un segundo Escape seguido, sin pasar por `cancel`: si no se atiende, el panel se queda vacío.
      onClose={cerrarVentana}
      onClick={(e) => { if (e.target === e.currentTarget) cerrarVentana(); }}
      className={`fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-black/60 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: `${DURACION_APARICION}ms` }}>
      <div onClick={(e) => e.stopPropagation()} className={`absolute inset-0 lg:inset-5 flex flex-col min-h-0 bg-digi-card lg:rounded-lg lg:border lg:border-digi-border overflow-hidden transition-transform ${visible ? 'scale-100' : 'scale-[.98]'}`} style={{ transitionDuration: `${DURACION_APARICION}ms` }}>
        <div className="shrink-0 flex items-center gap-2 px-3 lg:px-4 h-11 lg:h-12 border-b border-digi-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-semibold text-digi-text truncate" title={doc?.resumen}>{proyecto?.nombre}</h2>
            {estado?.actualizado && <p className="hidden lg:block text-[11px] leading-[14px] text-digi-muted truncate">{proyecto?.grupo} · actualizado {hace(estado.actualizado)}</p>}
          </div>
          {marcaGenerando}
          {doc && <SelectorRol doc={doc} rol={rol} alCambiar={cambiarRol} className="max-w-[45%] lg:max-w-[220px]" />}
          <BotonCerrar onClick={cerrarVentana} etiqueta="Cerrar el diagrama" />
        </div>
        <div className="flex-1 min-h-0">{lienzo(true)}</div>
        {listo && <Leyenda />}
      </div>
    </dialog>
  );

  if (forma === 'ventana') return <>{ventana}</>;
  if (forma === 'plegado') {
    return (
      <>
        <button type="button" onClick={() => setMaximizado(true)} aria-label="Abrir el diagrama de flujo" title="Diagrama de flujo" className={BTN_ICONO_FILA}><Workflow className="w-4 h-4" /></button>
        {ventana}
      </>
    );
  }
  return (
    <section aria-label="Diagrama de flujo" className="shrink-0 h-[46%] min-h-[220px] flex flex-col border-t border-digi-border">
      <div className="shrink-0 flex items-center gap-1 pl-3 pr-1.5 min-h-9">
        <p className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">Flujo</p>
        <span className="flex-1 min-w-0 text-[11px] text-digi-muted truncate" title={estado?.actualizado ? `${proyecto?.nombre} · actualizado ${hace(estado.actualizado)}` : proyecto?.nombre}>{proyecto?.nombre}</span>
        {marcaGenerando}
        {listo && <SelectorRol doc={doc!} rol={rol} alCambiar={cambiarRol} className="max-w-[108px]" />}
        <button type="button" disabled={!proyecto} onClick={() => setMaximizado(true)} aria-label="Maximizar el diagrama" title="Maximizar" className={BTN_ICONO_FILA}><Maximize2 className="w-3.5 h-3.5" /></button>
      </div>
      {/* Al maximizar se desmonta: dos lienzos a la vez gastan el doble y solo se ve uno. */}
      <div className="flex-1 min-h-0">{maximizado ? null : lienzo(false)}</div>
      {ventana}
    </section>
  );
}
