'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Send, Loader2, AlertTriangle, X, Plus } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import Segmentado from '@/components/ui/Segmentado';
import BotonEditar from '@/components/ui/BotonEditar';
import BotonEliminar from '@/components/ui/BotonEliminar';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelInput from '@/components/ui/PixelInput';
import { QuickEditDialog } from '@/components/ui/EditDialog';
import { hace } from '@/components/espacio/api';
import { useGumdramon, type Consulta, type Dictado, type SesionGum } from './useGumdramon';

type Vista = 'respuestas' | 'transcripcion' | 'sesiones';

/** El personaje. Vive fuera del repositorio (es público): si la Mac no lo tiene, no se pinta nada. */
function Personaje({ className }: { className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/api/copiloto/icono" alt="" className={`object-contain ${className}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
}

/** La misma cuenta atrás de la Mac: baja mientras callas y vuelve a empezar si hablas. */
function CuentaAtras({ restante, total }: { restante: number | null; total: number }) {
  const r = 12;
  const largo = 2 * Math.PI * r;
  const parte = Math.min(1, (restante ?? total) / total);
  return (
    <span className="relative w-8 h-8 shrink-0 inline-flex items-center justify-center" role="timer" aria-label={restante == null ? 'Escuchando' : `Envío en ${Math.ceil(restante)} segundos`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-digi-border" />
        <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent transition-[stroke-dashoffset] duration-100" strokeDasharray={largo} strokeDashoffset={largo * (1 - parte)} />
      </svg>
      <span className="text-[12px] font-semibold tabular-nums text-digi-text">{Math.ceil(restante ?? total)}</span>
    </span>
  );
}

function TarjetaConsulta({ c, detener }: { c: Consulta; detener: () => void }) {
  return (
    <article className="bg-digi-card border border-digi-border rounded-xl p-3.5">
      <p className="text-[12.5px] text-digi-muted whitespace-pre-wrap">{c.pregunta}</p>
      {c.respuesta ? (
        <p className="mt-1.5 text-[15.5px] font-medium leading-snug text-digi-text whitespace-pre-wrap">{c.respuesta}</p>
      ) : !c.terminada && (
        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-digi-muted">
          <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0" />
          <span className="flex-1 min-w-0 truncate">{c.buscando ? c.detalle || 'Investigando…' : 'Pensando…'}</span>
          <button type="button" onClick={detener} className={`${BTN_SECONDARY} !py-1 !px-2.5 !min-h-0 text-[12px]`}>Detener</button>
        </div>
      )}
    </article>
  );
}

function TarjetaDictado({ d }: { d: Dictado }) {
  return (
    <article className="border border-accent rounded-xl p-3.5">
      <div className="flex items-center gap-2.5">
        <CuentaAtras restante={d.restante} total={d.total} />
        <span className="text-[12.5px] text-digi-muted">{d.restante == null ? 'Te escucho' : 'Envío al llegar a 0'}</span>
      </div>
      {d.texto && <p className="mt-2 text-[14.5px] leading-snug text-digi-text">{d.texto}</p>}
    </article>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="h-full min-h-[12rem] flex flex-col items-center justify-center gap-3 text-center">
      <Personaje className="w-16 h-16 opacity-90" />
      <p className="text-[14px] text-digi-muted max-w-[18rem]">{texto}</p>
    </div>
  );
}

function FilaSesion({ s, retomar, editar, eliminar }: { s: SesionGum; retomar: () => void; editar: () => void; eliminar: () => void }) {
  return (
    <li className={`flex items-center gap-1 rounded-xl border pl-3.5 pr-1.5 ${s.actual ? 'border-accent bg-digi-card' : 'border-digi-border bg-digi-card'}`}>
      <button type="button" onClick={retomar} disabled={s.actual} className="flex-1 min-w-0 py-3 text-left disabled:cursor-default">
        <span className="block text-[14px] font-medium text-digi-text line-clamp-2">{s.titulo}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px]">
          <span className="text-digi-muted">{hace(s.actualizada)}</span>
          {s.actual && <span className="font-semibold text-accent">En uso</span>}
          {s.trabajando && <span className="text-amber-500">Respondiendo</span>}
        </span>
      </button>
      <BotonEditar onClick={editar} etiqueta="Cambiar el nombre" title="Cambiar el nombre" />
      <BotonEliminar onClick={eliminar} etiqueta="Eliminar la sesión" title="Eliminar" disabled={s.trabajando} />
    </li>
  );
}

/**
 * GUMDRAMON EN EL TELÉFONO, rehecho desde cero el 2026-11-08 (Fernando: «deje de tener estos fallos de
 * diseño»). Va dentro del marco de la app, bajo su cabecera: por eso no repite el nombre ni reserva los
 * márgenes del iPhone, que pone el marco; ocupa todo el alto, con la lista en medio y el pie fijo abajo.
 * La lógica vive en `useGumdramon`.
 */
export default function PanelGumdramon() {
  const g = useGumdramon();
  const [vista, setVista] = useState<Vista>('respuestas');
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<SesionGum | null>(null);
  const [nombre, setNombre] = useState('');
  const [borrando, setBorrando] = useState<SesionGum | null>(null);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { if (vista !== 'sesiones') fin.current?.scrollIntoView?.({ block: 'end' }); }, [g.consultas, g.dictado, g.lineas.length, vista]);
  useEffect(() => { if (vista === 'sesiones') g.cargarSesiones(); }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  const estado = !g.conectado
    ? { punto: 'bg-red-500', texto: 'Sin conexión con la Mac' }
    : g.capturando ? { punto: 'bg-emerald-500', texto: g.dictado ? 'Te escucho…' : 'Escuchando desde este teléfono' }
      : g.enOtro ? { punto: 'bg-amber-500', texto: 'Escuchando desde la Mac' }
        : { punto: 'bg-digi-muted', texto: 'Desactivado' };

  const enviar = () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    g.preguntar(t);
  };

  return (
    <div className="h-full flex flex-col bg-digi-dark text-digi-text">
      <div className="shrink-0 h-12 flex items-center gap-2.5 pl-3 pr-1.5 bg-digi-card border-b border-digi-border">
        <Personaje className="w-7 h-7" />
        <span className={`w-2 h-2 rounded-full shrink-0 ${estado.punto}`} aria-hidden />
        <p className="flex-1 min-w-0 truncate text-[13.5px]" aria-live="polite">{estado.texto}</p>
        {g.capturando && (
          <span className="w-12 h-1 rounded-full bg-digi-border overflow-hidden shrink-0" aria-hidden>
            <span className="block h-full bg-accent" style={{ width: `${Math.min(100, g.nivel * 800)}%` }} />
          </span>
        )}
        <button type="button" onClick={g.alternarVoz} aria-label={g.voz ? 'Apagar la voz' : 'Activar la voz'} aria-pressed={g.voz} title={g.voz ? 'Voz activada' : 'Voz apagada'}
          className="w-10 h-10 shrink-0 rounded-lg inline-flex items-center justify-center text-digi-muted hover:text-digi-text">
          {g.voz ? <Volume2 className="w-5 h-5 text-accent" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {g.aviso && (
        <div className="shrink-0 flex items-start gap-2 px-4 py-2.5 border-b border-digi-border text-[13px]" role="alert">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">{g.aviso}</span>
          <button type="button" onClick={g.cerrarAviso} aria-label="Cerrar aviso" className="w-6 h-6 -m-1 inline-flex items-center justify-center text-digi-muted"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="shrink-0 px-3 pt-3">
        <Segmentado<Vista> etiqueta="Vista" className="w-full" valor={vista} onChange={setVista}
          opciones={[{ valor: 'respuestas', texto: 'Respuestas' }, { valor: 'transcripcion', texto: 'Transcripción' }, { valor: 'sesiones', texto: 'Sesiones' }]} />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {vista === 'respuestas' && (
          !g.consultas.length && !g.dictado
            ? <Vacio texto={g.capturando ? 'Di «GUMDRAMON» y tu pregunta.' : g.enOtro ? 'Gumdramon está escuchando desde la Mac.' : 'Actívalo para empezar.'} />
            : (
              <div className="space-y-2.5">
                {g.consultas.map((c) => <TarjetaConsulta key={c.id} c={c} detener={g.detenerConsulta} />)}
                {g.dictado && <TarjetaDictado d={g.dictado} />}
              </div>
            )
        )}
        {vista === 'transcripcion' && (
          !g.lineas.length
            ? <Vacio texto="Todavía no hay transcripción." />
            : (
              <div className="space-y-1.5">
                {g.lineas.map((l, i) => (
                  <p key={i} className="text-[13.5px] leading-snug">
                    <strong className={`font-semibold ${l.quien === 'Cliente' ? 'text-accent' : 'text-digi-muted'}`}>{l.quien}:</strong> {l.texto}
                  </p>
                ))}
              </div>
            )
        )}
        {vista === 'sesiones' && (
          <div className="space-y-2.5">
            <button type="button" onClick={g.nuevaSesion} className={`${BTN_SECONDARY} w-full`}><Plus className="w-4 h-4" /> Nueva sesión</button>
            {g.sesiones === null
              ? <div className="pt-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>
              : !g.sesiones.length
                ? <Vacio texto="Aún no hay sesiones." />
                : (
                  <ul className="space-y-2">
                    {g.sesiones.map((s) => (
                      <FilaSesion key={s.id} s={s}
                        retomar={() => { g.retomar(s.id); setVista('respuestas'); }}
                        editar={() => { setNombre(s.titulo); setEditando(s); }}
                        eliminar={() => setBorrando(s)} />
                    ))}
                  </ul>
                )}
          </div>
        )}
        <div ref={fin} />
      </main>

      <footer className="shrink-0 bg-digi-card border-t border-digi-border px-3 pt-3 pb-3 space-y-2.5">
        {g.nota && <p className="text-[12.5px] text-digi-muted">{g.nota}</p>}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!g.activo} aria-label="Pregunta escrita"
            placeholder={g.activo ? 'Escribe una pregunta' : 'Actívalo para preguntar'}
            className="field-control flex-1 min-w-0 h-11 px-3 rounded-lg bg-digi-darker border border-digi-border text-[16px] text-digi-text placeholder:text-digi-muted/70 focus:outline-none disabled:opacity-60" />
          <button type="submit" disabled={!g.activo || !texto.trim()} aria-label="Enviar" className={`${BTN_SECONDARY} !h-11 !w-11 !px-0 shrink-0`}><Send className="w-4 h-4" /></button>
        </form>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={g.terminar} disabled={!g.activo && !g.lineas.length} className={`${BTN_SECONDARY} !h-11`}>Terminar</button>
          <button type="button" onClick={g.alternar} disabled={!g.conectado} className={`${BTN_PRIMARY} !h-11`}>
            {g.capturando ? 'Desactivar' : g.enOtro ? 'Usar este teléfono' : 'Activar'}
          </button>
        </div>
      </footer>

      <QuickEditDialog open={!!editando} title="Nombre de la sesión" onClose={() => setEditando(null)} canSave={!!nombre.trim()}
        onSave={() => { if (editando) g.renombrar(editando.id, nombre.trim()); setEditando(null); }}>
        <PixelInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus maxLength={200} />
      </QuickEditDialog>
      <PixelConfirm open={!!borrando} title="Eliminar la sesión" danger confirmLabel="Eliminar"
        message={`«${borrando?.titulo ?? ''}» va a la papelera del Espacio de trabajo y se borra a los 30 días.`}
        onConfirm={() => { if (borrando) g.eliminar(borrando.id); setBorrando(null); }} onCancel={() => setBorrando(null)} />
    </div>
  );
}
