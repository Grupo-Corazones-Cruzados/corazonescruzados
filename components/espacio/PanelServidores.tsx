'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, CircleSlash, Database, ExternalLink, Loader2, Moon, PanelRightClose, PanelRightOpen, Server, ServerOff } from 'lucide-react';
import { BTN_ICONO_FILA } from '@/components/ui/Button';
import { money } from '@/lib/format';
import { api, hace } from './api';

type EstadoServicio = 'procesando' | 'fallo' | 'dormido' | 'publicado' | 'sin';
interface Servicio { id: string; nombre: string; base: boolean; estado: EstadoServicio; status: string | null; fecha: number | null; commit: string | null; mensaje: string | null; costo: number | null; url: string }
interface Servidor { id: string; nombre: string; url: string; estado: 'procesando' | 'fallo' | 'publicado'; publicando: number; fallidos: number; fecha: number | null; costo: number | null; servicios: Servicio[]; proyectos: string[]; ajeno?: boolean }
export interface DatosServidores {
  conectado: boolean;
  desactualizado?: boolean;
  actualizado?: number;
  ciclo?: { consumo: number; hasta: number; plan: string } | null;
  servidores: Servidor[];
  sinAcceso: { id: string; nombre: string; grupo: string }[];
}

const CADA_MS = 30_000;
const CADA_PUBLICANDO_MS = 15_000;
const LLAVE_PLEGADO = 'espacio_servidores_plegado';
/** Por debajo no caben tres columnas: empieza plegado. */
const ANCHO_PARA_ABRIR = 1180;
const MINIMO_PRO = 20;

const TEXTO_STATUS: Record<string, string> = {
  QUEUED: 'En cola', WAITING: 'En cola', INITIALIZING: 'Preparando', BUILDING: 'Construyendo', DEPLOYING: 'Publicando', NEEDS_APPROVAL: 'Espera aprobación',
  FAILED: 'Falló', CRASHED: 'Caído', SUCCESS: 'Publicado', SLEEPING: 'Dormido', REMOVED: 'Retirado',
};

function IconoServicio({ s }: { s: Servicio }) {
  const clase = 'w-3.5 h-3.5';
  if (s.estado === 'procesando') return <Loader2 className={`${clase} text-accent animate-spin`} />;
  if (s.estado === 'fallo') return <AlertCircle className={`${clase} text-red-400`} />;
  if (s.base) return <Database className={`${clase} text-digi-muted`} />;
  if (s.estado === 'dormido') return <Moon className={`${clase} text-digi-muted`} />;
  if (s.estado === 'publicado') return <CheckCircle2 className={`${clase} text-green-400`} />;
  return <CircleSlash className={`${clase} text-digi-muted`} />;
}

function Enlace({ url, nombre }: { url: string; nombre: string }) {
  return <a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir ${nombre} en Railway`} title="Abrir en Railway" className={BTN_ICONO_FILA}><ExternalLink className="w-3.5 h-3.5" /></a>;
}

function FilaServicio({ s }: { s: Servicio }) {
  const etiqueta = s.status ? TEXTO_STATUS[s.status] || s.status : 'Sin publicar';
  const color = s.estado === 'procesando' ? 'text-accent' : s.estado === 'fallo' ? 'text-red-400' : '';
  return (
    <li className="flex items-start gap-1.5 pl-6 pr-1 py-1 min-w-0">
      <span role="img" aria-label={etiqueta} title={etiqueta} className="shrink-0 mt-[2px]"><IconoServicio s={s} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] text-digi-text truncate" title={s.nombre}>{s.nombre}</span>
        <span className="block text-[11px] text-digi-muted truncate" title={s.mensaje || undefined}>
          <span className={color}>{s.base && s.estado === 'publicado' ? 'En línea' : etiqueta}</span>
          {s.fecha ? <> · {hace(s.fecha)}</> : null}
          {s.commit ? <> · <span className="font-mono">{s.commit}</span></> : null}
        </span>
        {s.mensaje && <span className="block text-[11px] text-digi-muted truncate" title={s.mensaje}>{s.mensaje}</span>}
      </span>
      {s.costo !== null && <span className="shrink-0 mt-[1px] text-[11px] tabular-nums text-digi-muted">{money(s.costo)}</span>}
      <Enlace url={s.url} nombre={s.nombre} />
    </li>
  );
}

function FilaServidor({ s, actual, abierto, alAlternar }: { s: Servidor; actual: boolean; abierto: boolean; alAlternar: () => void }) {
  const linea = s.publicando ? <span className="text-accent">Publicando {s.publicando} de {s.servicios.length}</span>
    : s.fallidos ? <span className="text-red-400">{s.fallidos === 1 ? '1 servicio falló' : `${s.fallidos} servicios fallaron`}</span>
    : s.fecha ? <>Último cambio {hace(s.fecha)}</> : 'Sin cambios publicados';
  return (
    <div>
      <div className={`flex items-center gap-0.5 rounded-md pr-1 min-w-0 ${actual ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`} aria-current={actual ? 'true' : undefined}>
        <button type="button" onClick={alAlternar} aria-expanded={abierto} className="flex-1 min-w-0 flex items-start gap-1.5 px-1.5 py-1.5 text-left">
          <ChevronRight className={`shrink-0 mt-[2px] w-3.5 h-3.5 text-digi-muted transition-transform ${abierto ? 'rotate-90' : ''}`} />
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-medium text-digi-text truncate" title={s.nombre}>{s.nombre}</span>
            <span className="block text-[11px] text-digi-muted truncate">{linea}</span>
          </span>
          {s.costo !== null
            ? <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-digi-text">{money(s.costo)}</span>
            : s.ajeno && <span className="shrink-0 text-[11px] text-digi-muted" title="Este servidor se paga en la cuenta de Railway del cliente">Otra cuenta</span>}
        </button>
        <Enlace url={s.url} nombre={s.nombre} />
      </div>
      {abierto && <ul>{s.servicios.map((x) => <FilaServicio key={x.id} s={x} />)}</ul>}
    </div>
  );
}

/** El resumen de lo que está pasando, para verlo con el panel plegado. */
function IconoGeneral({ datos }: { datos: DatosServidores | null }) {
  if (datos?.servidores.some((s) => s.estado === 'procesando')) return <span role="img" aria-label="Publicando"><Loader2 className="w-4 h-4 text-accent animate-spin" /></span>;
  if (datos?.servidores.some((s) => s.estado === 'fallo')) return <span role="img" aria-label="Algo falló"><AlertCircle className="w-4 h-4 text-red-400" /></span>;
  return <Server className="w-4 h-4 text-digi-muted" />;
}

export default function PanelServidores({ proyectoId, plegable, cabecera }: { proyectoId: string | null; plegable: boolean; cabecera?: React.ReactNode }) {
  const [datos, setDatos] = useState<DatosServidores | null>(null);
  const [error, setError] = useState('');
  const [plegado, setPlegado] = useState(false);
  const [elegidos, setElegidos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!plegable) return;
    const guardado = localStorage.getItem(LLAVE_PLEGADO);
    setPlegado(guardado === null ? window.innerWidth < ANCHO_PARA_ABRIR : guardado === '1');
  }, [plegable]);

  const publicando = !!datos?.servidores.some((s) => s.estado === 'procesando');
  useEffect(() => {
    let vivo = true;
    const traer = () => {
      if (document.visibilityState === 'hidden') return;
      api<DatosServidores>('/servidores').then((j) => { if (vivo) { setDatos(j); setError(''); } }).catch((e) => { if (vivo) setError(e.message); });
    };
    traer();
    const t = setInterval(traer, publicando ? CADA_PUBLICANDO_MS : CADA_MS);
    document.addEventListener('visibilitychange', traer);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', traer); };
  }, [publicando]);

  const alternarPlegado = () => setPlegado((p) => { localStorage.setItem(LLAVE_PLEGADO, p ? '0' : '1'); return !p; });

  if (plegable && plegado) {
    return (
      <aside aria-label="Servidores" className="shrink-0 w-10 h-full border-l border-digi-border flex flex-col items-center gap-2 py-2">
        <button type="button" onClick={alternarPlegado} aria-label="Abrir servidores" title="Abrir servidores" className={BTN_ICONO_FILA}><PanelRightOpen className="w-4 h-4" /></button>
        <IconoGeneral datos={datos} />
      </aside>
    );
  }

  const ciclo = datos?.ciclo;
  return (
    <aside aria-label="Servidores" className={`flex flex-col h-full min-h-0 ${plegable ? 'shrink-0 w-[320px] border-l border-digi-border' : 'w-full'}`}>
      {cabecera}
      <div className="shrink-0 px-3 pt-2 pb-2 border-b border-digi-border">
        {plegable && (
          <div className="flex items-center justify-between gap-2 min-h-7">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">Servidores</p>
            <button type="button" onClick={alternarPlegado} aria-label="Plegar servidores" title="Plegar servidores" className={BTN_ICONO_FILA}><PanelRightClose className="w-4 h-4" /></button>
          </div>
        )}
        {ciclo && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[18px] font-semibold tabular-nums text-digi-text">{money(ciclo.consumo)}</span>
            <span className="text-[11px] text-digi-muted truncate">
              {ciclo.plan === 'PRO' && <>de {money(MINIMO_PRO)} mínimos · </>}cierra el {new Date(ciclo.hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
        {datos?.desactualizado && <p className="mt-1 text-[11px] text-amber-400">Sin conexión con Railway. Datos de {hace(datos.actualizado)}.</p>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 py-1.5 space-y-0.5">
        {!datos && !error && <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-digi-muted" /></div>}
        {!datos && error && <p className="px-2 py-2 text-[12px] text-red-400">{error}</p>}
        {datos && !datos.conectado && <p className="px-2 py-2 text-[12px] text-digi-muted">Railway pide iniciar sesión. Ejecuta <span className="font-mono">railway login</span> en la Mac.</p>}
        {datos?.servidores.map((s) => (
          <FilaServidor key={s.id} s={s} actual={!!proyectoId && s.proyectos.includes(proyectoId)}
            abierto={elegidos[s.id] ?? s.estado !== 'publicado'}
            alAlternar={() => setElegidos((e) => ({ ...e, [s.id]: !(e[s.id] ?? s.estado !== 'publicado') }))} />
        ))}
        {!!datos?.sinAcceso.length && (
          <section aria-label="Sin acceso" className="pt-2">
            <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">Sin acceso · {datos.sinAcceso.length}</p>
            {datos.sinAcceso.map((p) => (
              <div key={p.id} aria-disabled="true" title="Esta cuenta de Railway no puede ver su servidor" className="flex items-center gap-1.5 px-2 py-1 opacity-50 cursor-not-allowed min-w-0">
                <ServerOff className="shrink-0 w-3.5 h-3.5 text-digi-muted" />
                <span className="flex-1 min-w-0 text-[12px] text-digi-muted truncate" title={p.nombre}>{p.nombre}</span>
                <span className="shrink-0 max-w-[45%] text-[11px] text-digi-muted truncate" title={p.grupo}>{p.grupo}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </aside>
  );
}
