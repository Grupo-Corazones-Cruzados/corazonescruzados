'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, Plus, Search } from 'lucide-react';
import BotonEditar from '@/components/ui/BotonEditar';
import { BTN_ICONO_FILA } from '@/components/ui/Button';
import { api, hace, TEXTO_ESTADO, type Proyecto, type Sesion, type Viva } from './api';

export function FilaSesion({ titulo, linea, activa, alElegir }: { titulo: string; linea: React.ReactNode; activa: boolean; alElegir: () => void }) {
  return (
    <button type="button" onClick={alElegir} aria-current={activa ? 'true' : undefined}
      className={`w-full text-left rounded-md px-2 py-1 lg:py-1.5 min-w-0 block transition-colors ${activa ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`}>
      <span className="block text-[12.5px] text-digi-text truncate" title={titulo}>{titulo}</span>
      <span className="block text-[11px] text-digi-muted truncate">{linea}</span>
    </button>
  );
}

function lineaSesion(s: Sesion) {
  const viva = s.viva && s.viva.estado !== 'cerrada' ? TEXTO_ESTADO[s.viva.estado] : null;
  return (
    <>
      {viva ? <span className={viva.clase}>{viva.texto}</span> : s.error ? <span className="text-red-400">Se detuvo</span> : s.enTerminal ? <span className="text-amber-400">En una terminal</span> : hace(s.actualizada)}
      {s.rama && <> · {s.rama}</>}
    </>
  );
}

export default function RailProyectos({ proyectos, vivas, proyectoId, sesionId, version, alElegir, alNueva, alEditar, alAgregar }: {
  proyectos: Proyecto[];
  vivas: Viva[];
  proyectoId: string | null;
  sesionId: string | null;
  version: number;
  alElegir: (proyecto: string, sesion: string) => void;
  alNueva: (proyecto: string) => void;
  alEditar: (p: Proyecto) => void;
  alAgregar: () => void;
}) {
  const [buscar, setBuscar] = useState('');
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [sesiones, setSesiones] = useState<Record<string, Sesion[]>>({});
  const [cargando, setCargando] = useState<Set<string>>(new Set());

  useEffect(() => { if (proyectoId) setAbiertos((a) => (a.has(proyectoId) ? a : new Set(a).add(proyectoId))); }, [proyectoId]);

  const clave = [...abiertos].join();
  useEffect(() => {
    let vivo = true;
    const traer = () => abiertos.forEach((id) => {
      setCargando((c) => (sesiones[id] ? c : new Set(c).add(id)));
      api(`/proyectos/${id}/sesiones`)
        .then((j) => { if (vivo) setSesiones((s) => ({ ...s, [id]: j.sesiones })); })
        .catch(() => {})
        .finally(() => { if (vivo) setCargando((c) => { const n = new Set(c); n.delete(id); return n; }); });
    });
    traer();
    const t = setInterval(traer, 20000);
    return () => { vivo = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, version]);

  const q = buscar.trim().toLowerCase();
  const grupos = useMemo(() => {
    const m = new Map<string, Proyecto[]>();
    for (const p of proyectos) {
      if (q && !`${p.nombre} ${p.grupo}`.toLowerCase().includes(q)) continue;
      m.set(p.grupo, [...(m.get(p.grupo) || []), p]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [proyectos, q]);

  /* Lo que está en marcha, arriba y sin tener que abrir nada: es lo que se vigila. */
  const enMarcha = vivas.filter((v) => v.estado !== 'cerrada' && (v.estado !== 'libre' || v.noVisto));

  function alternar(id: string) {
    setAbiertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  const tituloDe = (v: Viva) => sesiones[v.proyecto]?.find((s) => s.id === v.id)?.titulo || proyectos.find((p) => p.id === v.proyecto)?.nombre || 'Sesión';

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 lg:p-2">
        <label className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-digi-muted pointer-events-none" />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar proyecto" aria-label="Buscar proyecto"
            className="w-full h-9 lg:h-8 rounded-md border border-digi-border bg-digi-darker pl-8 pr-2 text-[16px] lg:text-[12.5px] text-digi-text placeholder:text-digi-muted outline-none focus:border-digi-muted" />
        </label>
        <button type="button" onClick={alAgregar} aria-label="Agregar proyecto" title="Agregar proyecto" className={BTN_ICONO_FILA}><Plus className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-2 space-y-1.5 lg:space-y-3">
        {enMarcha.length > 0 && !q && (
          <div>
            <p className="px-2 mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">En marcha</p>
            {enMarcha.map((v) => (
              <FilaSesion key={v.id} titulo={tituloDe(v)} activa={sesionId === v.id} alElegir={() => alElegir(v.proyecto, v.id)}
                linea={<><span className={TEXTO_ESTADO[v.estado].clase}>{TEXTO_ESTADO[v.estado].texto}</span> · {proyectos.find((p) => p.id === v.proyecto)?.nombre}</>} />
            ))}
          </div>
        )}
        {grupos.map(([grupo, lista]) => (
          <div key={grupo}>
            <p className="px-2 mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted truncate">{grupo}</p>
            {lista.map((p) => {
              const abierto = abiertos.has(p.id);
              const activos = vivas.filter((v) => v.proyecto === p.id && v.estado !== 'cerrada' && v.estado !== 'libre').length;
              return (
                <div key={p.id}>
                  <div className="group flex items-center gap-0.5 min-w-0">
                    <button type="button" onClick={() => alternar(p.id)} aria-expanded={abierto} title={p.ruta}
                      className="flex-1 min-w-0 flex items-center gap-1.5 min-h-9 lg:min-h-8 rounded-md px-1.5 text-left hover:bg-black/[0.03]">
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 text-digi-muted transition-transform ${abierto ? 'rotate-90' : ''}`} />
                      <span className="text-[13px] font-medium text-digi-text truncate">{p.nombre}</span>
                      {activos > 0 && <span className="shrink-0 text-[11px] font-semibold tabular-nums text-accent">{activos}</span>}
                    </button>
                    <span className="hidden lg:inline-flex lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity"><BotonEditar onClick={() => alEditar(p)} etiqueta={`Editar ${p.nombre}`} /></span>
                    <button type="button" onClick={() => alNueva(p.id)} aria-label={`Sesión nueva en ${p.nombre}`} title="Sesión nueva" className={BTN_ICONO_FILA}><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  {abierto && (
                    <div className="ml-3 pl-1.5 border-l border-digi-border mb-1 min-w-0">
                      {cargando.has(p.id) && !sesiones[p.id] && <Loader2 className="w-3.5 h-3.5 m-2 animate-spin text-digi-muted" />}
                      {sesiones[p.id]?.length === 0 && <p className="px-2 py-1.5 text-[12px] text-digi-muted">Sin sesiones</p>}
                      {sesiones[p.id]?.map((s) => <FilaSesion key={s.id} titulo={s.titulo} linea={lineaSesion(s)} activa={sesionId === s.id} alElegir={() => alElegir(p.id, s.id)} />)}
                      <button type="button" onClick={() => alEditar(p)} className="lg:hidden px-2 py-1.5 text-[12px] text-digi-muted hover:text-digi-text">Editar proyecto</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {!grupos.length && <p className="px-2 py-6 text-center text-[12.5px] text-digi-muted">Sin proyectos</p>}
      </div>
    </div>
  );
}
