'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, Video, Plus, Save } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/** «2h 15m» · «45m» · «0m». */
export function fmtTiempo(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
/** Reloj «01:05:09». */
function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
/** «h:mm» para el campo de tiempo. */
function aHm(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}
/** Acepta «2:15» o «2.25» (horas). Devuelve segundos, o null si no se entiende. */
function deHm(txt: string): number | null {
  const t = txt.trim().replace(',', '.');
  const m = t.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 3600);
  return null;
}
/** El día de un registro como `AAAA-MM-DD` (llega como fecha o como texto). */
export function diaDe(r: any): string {
  return String(r.work_date || r.created_at || '').slice(0, 10);
}
/** Segundos de un registro, contando el reloj si está en marcha. */
export function segundosDe(r: any, ahora = Date.now()): number {
  const base = Number(r.duration_seconds) || 0;
  return r.timer_started_at ? base + Math.max(0, (ahora - new Date(r.timer_started_at).getTime()) / 1000) : base;
}

/**
 * EL REGISTRO DE TRABAJO DE UN DÍA (Fernando, 2026-09-30).
 *
 * Dos partes, como los requerimientos del proyecto: a la izquierda los registros del día
 * elegido en «Días de trabajo» (título en una línea, tiempo y costo debajo); a la derecha el
 * elegido, con su RELOJ (iniciar / detener), el tiempo consumido corregible a mano, el costo
 * que sale de él (tiempo × tarifa del servicio: no se escribe) y sus observaciones.
 *
 * El reloj vive en el servidor (`timer_started_at`): se puede cerrar la pestaña y sigue
 * contando. Solo uno en marcha por ticket.
 *
 * Con el ticket cerrado todo se ve pero no se toca, con el porqué en `title`: lo consumido
 * ya está facturado.
 */
export default function RegistroTrabajo({
  ticketId, registros, dia, tarifa, puede, bloqueo, onCambio, onSesionMeet, sesionOcupada,
}: {
  ticketId: string;
  registros: any[];
  /** Día elegido (`AAAA-MM-DD`). */
  dia: string;
  tarifa: number;
  /** Quien mira puede gestionar el registro (responsable o admin). */
  puede: boolean;
  /** Si no se puede tocar aunque se pueda gestionar (ticket cerrado), el porqué. */
  bloqueo?: string;
  onCambio: () => void;
  onSesionMeet?: () => void;
  sesionOcupada?: boolean;
}) {
  const editable = puede && !bloqueo;
  const [ahora, setAhora] = useState(Date.now());
  const delDia = useMemo(() => registros.filter((r) => diaDe(r) === dia), [registros, dia]);
  const [selId, setSelId] = useState<number | null>(null);
  const sel = delDia.find((r) => r.id === selId) || delDia[0] || null;
  const enMarcha = registros.some((r) => r.timer_started_at);

  // El reloj de la pantalla solo corre si hay alguno en marcha.
  useEffect(() => {
    if (!enMarcha) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enMarcha]);

  // Borradores del elegido: se reinician al cambiar de registro o al recargar.
  const [titulo, setTitulo] = useState('');
  const [notas, setNotas] = useState('');
  const [tiempo, setTiempo] = useState('');
  useEffect(() => {
    setTitulo(sel?.description || '');
    setNotas(sel?.notes || '');
    setTiempo(sel ? aHm(Number(sel.duration_seconds) || 0) : '');
  }, [sel?.id, sel?.description, sel?.notes, sel?.duration_seconds]);

  const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState('');

  const pedir = async (url: string, metodo: string, cuerpo?: any, ok?: string) => {
    setOcupado(true);
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      if (ok) toast.success(ok);
      onCambio();
      return d.data;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setOcupado(false); }
  };
  const url = (id: number) => `/api/tickets/${ticketId}/actions/${id}`;

  const agregar = async () => {
    const t = nuevo.trim(); if (!t) return;
    const d = await pedir(`/api/tickets/${ticketId}/actions`, 'POST', { description: t, work_date: dia });
    if (d) { setNuevo(''); setSelId(d.id); }
  };
  const guardarTiempo = () => {
    if (!sel) return;
    const s = deHm(tiempo);
    if (s == null) { toast.error('Escribe el tiempo como 2:15 o 2.25'); return; }
    pedir(url(sel.id), 'PATCH', { duration_seconds: s }, 'Tiempo actualizado');
  };
  const guardarTexto = () => {
    if (!sel) return;
    if (!titulo.trim()) { toast.error('El registro necesita un título'); return; }
    pedir(url(sel.id), 'PATCH', { description: titulo, notes: notas }, 'Registro guardado');
  };

  const segSel = sel ? segundosDe(sel, ahora) : 0;
  const cambiosTexto = !!sel && (titulo.trim() !== (sel.description || '') || notas.trim() !== (sel.notes || ''));
  const fechaLarga = new Date(dia + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-digi-text first-letter:uppercase" style={mf}>{fechaLarga}</p>
        {onSesionMeet && puede && (
          <span title={bloqueo || (sesionOcupada ? 'Ya hay un reloj en marcha' : 'Crea la reunión de Meet y un registro con el reloj en marcha')} className="inline-flex">
            <button type="button" onClick={onSesionMeet} disabled={!editable || sesionOcupada || enMarcha || tarifa <= 0} className={BTN_SECONDARY}>
              <Video className="w-4 h-4" /> Sesión con Meet
            </button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-3 lg:min-h-0 lg:flex-1">
        {/* ── Registros del día ── */}
        <div className="flex flex-col gap-1.5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {delDia.map((r) => {
            const elegido = sel?.id === r.id;
            const seg = segundosDe(r, ahora);
            return (
              <button key={r.id} type="button" onClick={() => setSelId(r.id)} aria-pressed={elegido}
                className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${elegido ? 'border-accent/50 bg-accent-light/60' : 'border-digi-border bg-white hover:border-accent/30'}`}>
                <p title={r.description} className="truncate text-[13px] font-medium text-digi-text leading-5" style={mf}>{r.description}</p>
                <p className="flex items-center gap-1.5 text-[12px] tabular-nums leading-4" style={mf}>
                  {r.timer_started_at && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-label="Reloj en marcha" />}
                  <span className="text-digi-muted">{fmtTiempo(seg)}</span>
                  <span className="text-accent font-semibold">${fmt2(r.timer_started_at ? (seg / 3600) * tarifa : Number(r.cost))}</span>
                </p>
              </button>
            );
          })}
          {delDia.length === 0 && <p className="text-[12px] text-digi-muted px-1 py-2" style={mf}>Sin registros este día.</p>}
          {puede && (
            <div className="flex gap-2 pt-1" title={bloqueo}>
              <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} disabled={!editable}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                placeholder="Nuevo registro…" className={`${EDIT_INPUT} flex-1 min-w-0`} style={mf} />
              <button type="button" onClick={agregar} disabled={!editable || ocupado || !nuevo.trim()} className={BTN_SECONDARY}>
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          )}
        </div>

        {/* ── El registro elegido ── */}
        {sel ? (
          <div className="rounded-lg border border-digi-border bg-white p-3.5 space-y-3.5 lg:min-h-0 lg:overflow-y-auto">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                {editable
                  ? <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={`${EDIT_INPUT} font-semibold`} style={mf} aria-label="Título" />
                  : <p className="text-[13.5px] font-semibold text-digi-text leading-snug" style={mf}>{sel.description}</p>}
              </div>
              {puede && (
                <BotonQuitar onClick={() => pedir(url(sel.id), 'DELETE', undefined, 'Registro eliminado')} disabled={!editable || ocupado}
                  etiqueta="Eliminar registro" title={bloqueo || 'Eliminar registro'} className="mt-1" />
              )}
            </div>

            {/* El reloj */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[0.03] px-4 py-3">
              <div>
                <p className={`text-[26px] font-bold tabular-nums leading-none ${sel.timer_started_at ? 'text-accent' : 'text-digi-text'}`} style={df}>{reloj(segSel)}</p>
                <p className="text-[12px] text-digi-muted tabular-nums mt-1" style={mf}>
                  ${fmt2((segSel / 3600) * tarifa)}{tarifa > 0 ? ` · $${fmt2(tarifa)}/h` : ''}
                </p>
              </div>
              {puede && (
                <span title={bloqueo || (tarifa <= 0 ? 'El servicio del ticket no tiene precio por hora' : undefined)} className="inline-flex">
                  {sel.timer_started_at ? (
                    <button type="button" onClick={() => pedir(url(sel.id), 'PATCH', { accion: 'detener' }, 'Reloj detenido')} disabled={!editable || ocupado} className={BTN_PRIMARY}>
                      <Square className="w-4 h-4" /> Detener
                    </button>
                  ) : (
                    <button type="button" onClick={() => pedir(url(sel.id), 'PATCH', { accion: 'iniciar' })}
                      disabled={!editable || ocupado || (enMarcha && !sel.timer_started_at)} className={BTN_PRIMARY}
                      title={enMarcha ? 'Ya hay un reloj en marcha en este ticket' : undefined}>
                      <Play className="w-4 h-4" /> Iniciar
                    </button>
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end" title={sel.timer_started_at ? 'Detén el reloj para corregir el tiempo' : bloqueo}>
              <EditField label="Tiempo consumido (h:mm)">
                <input value={tiempo} onChange={(e) => setTiempo(e.target.value)} disabled={!editable || !!sel.timer_started_at}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarTiempo(); } }}
                  className={`${EDIT_INPUT} tabular-nums`} style={mf} />
              </EditField>
              <button type="button" onClick={guardarTiempo}
                disabled={!editable || ocupado || !!sel.timer_started_at || deHm(tiempo) === Number(sel.duration_seconds)} className={BTN_SECONDARY}>
                Corregir
              </button>
            </div>

            <EditField label="Observaciones">
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={!editable} rows={4}
                className={`${EDIT_INPUT} resize-y`} style={mf} />
            </EditField>
            {editable && (
              <div className="flex justify-end">
                <button type="button" onClick={guardarTexto} disabled={ocupado || !cambiosTexto} className={BTN_PRIMARY}>
                  <Save className="w-4 h-4" /> Guardar
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-digi-border p-6 text-center text-[12px] text-digi-muted" style={mf}>
            Elige un registro.
          </div>
        )}
      </div>
    </div>
  );
}
