'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, Video, Plus, Save } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EditField, EDIT_INPUT, QuickEditDialog } from '@/components/ui/EditDialog';
import BotonQuitar from '@/components/ui/BotonQuitar';
import BotonEditar from '@/components/ui/BotonEditar';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { useConsultaMedia, PANTALLA_MD } from '@/lib/hooks/useConsultaMedia';
import { fmt2 } from '@/lib/format';
import { avisarCambioDeReloj } from '@/lib/movil/reloj-nativo';

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
 * EL REGISTRO DE TRABAJO DE UN DÍA (Fernando, 2026-09-30; rehecho el 2026-10-07).
 *
 * Dos partes, como los requerimientos del proyecto: la LISTA de los registros del día elegido
 * en «Días de trabajo» y el REGISTRO elegido, con su reloj (iniciar / detener), el tiempo
 * consumido corregible a mano, el costo que sale de él (tiempo × tarifa del servicio: no se
 * escribe) y sus observaciones.
 *
 * ⇒ LO QUE ES DEL REGISTRO COMO ELEMENTO VIVE EN LA LISTA (Fernando, 2026-10-07): el título
 * ya se lee en la fila, así que no se repite en el detalle; renombrarlo (lápiz →
 * `QuickEditDialog`) y eliminarlo (papelera → `PixelConfirm`) son botones de la fila. El
 * detalle se queda SOLO con el trabajo: reloj, tiempo y observaciones.
 *
 * ⇒ CADA ANCHO, SU DISEÑO:
 *  - Teléfono (< `md`): solo la lista; al tocar un registro se abre un PANEL con el reloj,
 *    el tiempo y las observaciones. Qué se MONTA se decide en JS (`useConsultaMedia`), no con
 *    `md:hidden`: un `<dialog>` escondido con CSS deja inerte toda la página.
 *  - Tableta y escritorio: lista y detalle lado a lado cuando la TARJETA tiene sitio
 *    (`@container`, `@xl` = 36rem); si no, uno sobre otro. Se pregunta al contenedor y no a la
 *    ventana porque lo que manda es cuánto le dejan las columnas de al lado.
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
  const enTelefono = !useConsultaMedia(PANTALLA_MD);
  const [ahora, setAhora] = useState(Date.now());
  const delDia = useMemo(() => registros.filter((r) => diaDe(r) === dia), [registros, dia]);
  const [selId, setSelId] = useState<number | null>(null);
  const sel = delDia.find((r) => r.id === selId) || delDia[0] || null;
  const enMarcha = registros.some((r) => r.timer_started_at);

  // El panel del teléfono solo existe en el teléfono: al pasar a un ancho mayor se cierra, y
  // se cierra también si el registro que mostraba desaparece (se borró o cambió de día).
  const [panelAbierto, setPanelAbierto] = useState(false);
  useEffect(() => { if (!enTelefono || !sel) setPanelAbierto(false); }, [enTelefono, sel]);

  // El reloj de la pantalla solo corre si hay alguno en marcha.
  useEffect(() => {
    if (!enMarcha) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enMarcha]);

  // Borradores del elegido: se reinician al cambiar de registro o al recargar.
  const [notas, setNotas] = useState('');
  const [tiempo, setTiempo] = useState('');
  useEffect(() => {
    setNotas(sel?.notes || '');
    setTiempo(sel ? aHm(Number(sel.duration_seconds) || 0) : '');
  }, [sel?.id, sel?.notes, sel?.duration_seconds]);

  const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState('');
  // Renombrar y eliminar salen de la fila: guardan a QUÉ registro se refieren, no el elegido.
  const [renombrando, setRenombrando] = useState<any | null>(null);
  const [tituloNuevo, setTituloNuevo] = useState('');
  const [eliminando, setEliminando] = useState<any | null>(null);

  const pedir = async (url: string, metodo: string, cuerpo?: any, ok?: string) => {
    setOcupado(true);
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      if (ok) toast.success(ok);
      onCambio();
      avisarCambioDeReloj();
      return d.data ?? true;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setOcupado(false); }
  };
  const url = (id: number) => `/api/tickets/${ticketId}/actions/${id}`;

  const agregar = async () => {
    const t = nuevo.trim(); if (!t) return;
    const d = await pedir(`/api/tickets/${ticketId}/actions`, 'POST', { description: t, work_date: dia });
    if (d) { setNuevo(''); if (d.id) setSelId(d.id); }
  };
  const elegir = (r: any) => {
    setSelId(r.id);
    if (enTelefono) setPanelAbierto(true);
  };
  const guardarTiempo = () => {
    if (!sel) return;
    const s = deHm(tiempo);
    if (s == null) { toast.error('Escribe el tiempo como 2:15 o 2.25'); return; }
    pedir(url(sel.id), 'PATCH', { duration_seconds: s }, 'Tiempo actualizado');
  };
  const guardarNotas = () => {
    if (!sel) return;
    pedir(url(sel.id), 'PATCH', { notes: notas }, 'Observaciones guardadas');
  };
  const abrirRenombrar = (r: any) => { setRenombrando(r); setTituloNuevo(r.description || ''); };
  const renombrar = async () => {
    if (!renombrando) return;
    const t = tituloNuevo.trim();
    if (!t) { toast.error('El registro necesita un título'); return; }
    if (await pedir(url(renombrando.id), 'PATCH', { description: t }, 'Registro renombrado')) setRenombrando(null);
  };
  const eliminar = async () => {
    if (!eliminando) return;
    const r = eliminando;
    setEliminando(null);
    await pedir(url(r.id), 'DELETE', undefined, 'Registro eliminado');
  };

  const segSel = sel ? segundosDe(sel, ahora) : 0;
  const cambiosNotas = !!sel && notas.trim() !== (sel.notes || '');
  const fechaLarga = new Date(dia + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── El trabajo del registro elegido: reloj, tiempo y observaciones. Lo mismo en la tarjeta
  //    de tableta/escritorio y en el panel del teléfono.
  const detalle = (r: any) => (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-black/[0.03] px-4 py-3">
        <div>
          <p className={`text-[26px] font-bold tabular-nums leading-none ${r.timer_started_at ? 'text-accent' : 'text-digi-text'}`} style={df}>{reloj(segSel)}</p>
          <p className="text-[12px] text-digi-muted tabular-nums mt-1" style={mf}>
            ${fmt2((segSel / 3600) * tarifa)}{tarifa > 0 ? ` · $${fmt2(tarifa)}/h` : ''}
          </p>
        </div>
        {puede && (
          <span title={bloqueo || (tarifa <= 0 ? 'El servicio del ticket no tiene precio por hora' : undefined)} className="inline-flex">
            {r.timer_started_at ? (
              <button type="button" onClick={() => pedir(url(r.id), 'PATCH', { accion: 'detener' }, 'Reloj detenido')} disabled={!editable || ocupado} className={`${BTN_PRIMARY} h-11 sm:h-auto`}>
                <Square className="w-4 h-4" /> Detener
              </button>
            ) : (
              <button type="button" onClick={() => pedir(url(r.id), 'PATCH', { accion: 'iniciar' })}
                disabled={!editable || ocupado || (enMarcha && !r.timer_started_at)} className={`${BTN_PRIMARY} h-11 sm:h-auto`}
                title={enMarcha ? 'Ya hay un reloj en marcha en este ticket' : undefined}>
                <Play className="w-4 h-4" /> Iniciar
              </button>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end" title={r.timer_started_at ? 'Detén el reloj para corregir el tiempo' : bloqueo}>
        <EditField label="Tiempo consumido (h:mm)">
          <input value={tiempo} onChange={(e) => setTiempo(e.target.value)} disabled={!editable || !!r.timer_started_at}
            inputMode="decimal"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarTiempo(); } }}
            className={`${EDIT_INPUT} tabular-nums`} style={mf} />
        </EditField>
        <button type="button" onClick={guardarTiempo}
          disabled={!editable || ocupado || !!r.timer_started_at || deHm(tiempo) === Number(r.duration_seconds)} className={`${BTN_SECONDARY} h-11 sm:h-auto`}>
          Corregir
        </button>
      </div>

      <EditField label="Observaciones">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} disabled={!editable} rows={4}
          className={`${EDIT_INPUT} resize-y`} style={mf} />
      </EditField>
      {editable && (
        <div className="flex justify-end">
          <button type="button" onClick={guardarNotas} disabled={ocupado || !cambiosNotas} className={`${BTN_PRIMARY} h-11 sm:h-auto`}>
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="@container flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-digi-text first-letter:uppercase" style={mf}>{fechaLarga}</p>
        {onSesionMeet && puede && (
          <span title={bloqueo || (sesionOcupada ? 'Ya hay un reloj en marcha' : 'Crea la reunión de Meet y un registro con el reloj en marcha')} className="inline-flex">
            <button type="button" onClick={onSesionMeet} disabled={!editable || sesionOcupada || enMarcha || tarifa <= 0} className={`${BTN_SECONDARY} h-11 sm:h-auto`}>
              <Video className="w-4 h-4" /> Sesión con Meet
            </button>
          </span>
        )}
      </div>

      {/* `grid-rows-[minmax(0,1fr)]`: sin esto la fila mide lo que su contenido y la lista y el
          registro no se desplazan por dentro —empujan la tarjeta más allá del pie—. Solo con
          las dos partes lado a lado (`@xl`); apiladas, cada una mide lo suyo. */}
      <div className="grid grid-cols-1 @xl:grid-cols-[minmax(0,42%)_minmax(0,1fr)] lg:@xl:grid-rows-[minmax(0,1fr)] gap-3 lg:min-h-0 lg:flex-1">
        {/* ── Registros del día ── */}
        <div className="flex flex-col gap-1.5 lg:@xl:min-h-0 lg:@xl:overflow-y-auto lg:@xl:pr-1">
          {delDia.map((r) => {
            const elegido = !enTelefono && sel?.id === r.id;
            const seg = segundosDe(r, ahora);
            return (
              // La fila tiene DOS destinos que no se pisan: la tarjeta (elige / abre el panel) y,
              // a su derecha y fuera de ella, renombrar y eliminar.
              <div key={r.id}
                className={`flex items-center gap-1 rounded-lg border pr-1.5 transition-colors ${elegido ? 'border-accent/50 bg-accent-light/60' : 'border-digi-border bg-white hover:border-accent/30'}`}>
                <button type="button" data-registro onClick={() => elegir(r)} aria-pressed={enTelefono ? undefined : elegido}
                  className="flex-1 min-w-0 text-left px-2.5 py-2 min-h-11 sm:min-h-0">
                  <p title={r.description} className="truncate text-[13px] font-medium text-digi-text leading-5" style={mf}>{r.description}</p>
                  <p className="flex items-center gap-1.5 text-[12px] tabular-nums leading-4" style={mf}>
                    {r.timer_started_at && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-label="Reloj en marcha" />}
                    <span className="text-digi-muted">{fmtTiempo(seg)}</span>
                    <span className="text-accent font-semibold">${fmt2(r.timer_started_at ? (seg / 3600) * tarifa : Number(r.cost))}</span>
                  </p>
                </button>
                {puede && (
                  <>
                    <BotonEditar onClick={() => abrirRenombrar(r)} disabled={!editable || ocupado}
                      etiqueta="Renombrar registro" title={bloqueo || 'Renombrar registro'} />
                    <BotonQuitar onClick={() => setEliminando(r)} disabled={!editable || ocupado}
                      etiqueta="Eliminar registro" title={bloqueo || 'Eliminar registro'} />
                  </>
                )}
              </div>
            );
          })}
          {delDia.length === 0 && <p className="text-[12px] text-digi-muted px-1 py-2" style={mf}>Sin registros este día.</p>}
          {puede && (
            <div className="flex gap-2 pt-1" title={bloqueo}>
              <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} disabled={!editable}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                placeholder="Nuevo registro…" className={`${EDIT_INPUT} flex-1 min-w-0`} style={mf} />
              <button type="button" onClick={agregar} disabled={!editable || ocupado || !nuevo.trim()} className={`${BTN_SECONDARY} h-11 sm:h-auto`}>
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          )}
        </div>

        {/* ── El registro elegido (tableta y escritorio) ── */}
        {!enTelefono && (sel ? (
          <div className="rounded-lg border border-digi-border bg-white p-3.5 lg:@xl:min-h-0 lg:@xl:overflow-y-auto">
            {detalle(sel)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-digi-border p-6 text-center text-[12px] text-digi-muted" style={mf}>
            Elige un registro.
          </div>
        ))}
      </div>

      {/* ── Teléfono: el registro tocado, solo con su trabajo ── */}
      {enTelefono && sel && (
        <PixelModal open={panelAbierto} onClose={() => setPanelAbierto(false)} title={sel.description} busy={ocupado}>
          {detalle(sel)}
        </PixelModal>
      )}

      <QuickEditDialog open={!!renombrando} title="Renombrar registro" onClose={() => setRenombrando(null)}
        onSave={renombrar} saving={ocupado} canSave={!!tituloNuevo.trim() && tituloNuevo.trim() !== (renombrando?.description || '')}>
        <EditField label="Título">
          <input value={tituloNuevo} onChange={(e) => setTituloNuevo(e.target.value)} autoFocus className={EDIT_INPUT} style={mf} />
        </EditField>
      </QuickEditDialog>

      <PixelConfirm open={!!eliminando} title="Eliminar registro"
        message={eliminando ? `Se eliminará «${eliminando.description}» con su tiempo (${fmtTiempo(segundosDe(eliminando, ahora))}). No se puede deshacer.` : ''}
        confirmLabel="Eliminar" danger onConfirm={eliminar} onCancel={() => setEliminando(null)} />
    </div>
  );
}
