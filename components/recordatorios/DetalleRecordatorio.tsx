'use client';

import { Check, CheckCircle2, Download, Paperclip, Pencil, RotateCcw } from 'lucide-react';
import PixelBadge from '@/components/ui/PixelBadge';
import PieAcciones from '@/components/ui/PieAcciones';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { effStatus, fmtDate, relative, STATUS_LABEL, STATUS_VARIANT, type Attach, type Reminder } from './comun';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * EL CUERPO DEL DETALLE, UNA SOLA VEZ. Lo pintan la columna de escritorio y el panel del teléfono del
 * módulo, y el Espacio de trabajo: tres copias del mismo bloque acabarían siendo tres detalles distintos.
 *
 * `enPanel`: en la columna de escritorio (`PanelDetalle`) la lista de tareas se queda con el
 * alto que sobra y se desplaza sola, y las acciones van al pie fijo (Fernando, 2026-10-29).
 * `alDescargar`: dentro de las apps un enlace no lleva la sesión; quien lo necesita descarga por su cuenta.
 */
export function ContenidoDetalle({ detail, cargando, enPanel, alMarcarTarea, alDescargar }: {
  detail: Reminder; cargando: boolean; enPanel: boolean; alMarcarTarea: (id: string) => void; alDescargar?: (a: Attach) => void;
}) {
  const estado = effStatus(detail);
  return (
    <>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-digi-muted" style={mf}>Estado</span>
        <PixelBadge variant={STATUS_VARIANT[estado] || 'default'}>{STATUS_LABEL[estado]}</PixelBadge>
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-digi-muted" style={mf}>Fecha y hora</span>
        <span className="text-digi-text text-right" style={mf}>
          {fmtDate(detail.remind_at)}
          {detail.remind_at && estado === 'active' && <span className="text-digi-muted"> · {relative(detail.remind_at)}</span>}
        </span>
      </div>

      {detail.notes && (
        <div className="pt-2 border-t border-digi-border">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={mf}>Notas</p>
          <p className="text-[12px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>{detail.notes}</p>
        </div>
      )}

      {/* Tareas (marcables) */}
      {cargando ? (
        <p className="text-[11px] text-digi-muted pt-1" style={mf}>Cargando…</p>
      ) : (detail.tasks?.length ?? 0) > 0 && (
        <div className={`pt-2 border-t border-digi-border ${enPanel ? 'flex-1 min-h-32 flex flex-col' : ''}`}>
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5 shrink-0" style={mf}>
            {detail.source === 'voz' ? 'Pasos' : 'Tareas'} ({(detail.tasks || []).filter((t) => t.done).length}/{detail.tasks!.length})
          </p>
          <div className={`space-y-1.5 ${enPanel ? 'min-h-0 overflow-y-auto' : ''}`}>
            {detail.tasks!.map((t) => {
              // Los de Gumdramon van como la skill `/pasos`: el primero sin hacer es «estamos aquí».
              const actual = detail.source === 'voz' && !t.done && t.id === (detail.tasks || []).find((x) => !x.done)?.id;
              return (
                <div key={t.id} aria-current={actual ? 'step' : undefined} className="flex items-start gap-2 text-[12.5px]">
                  <button type="button" onClick={() => alMarcarTarea(t.id)}
                    className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 mt-px transition-colors ${t.done ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker hover:border-accent'}`}>
                    {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 ${detail.source === 'voz' ? 'whitespace-pre-line' : ''} ${t.done ? 'line-through text-digi-muted' : actual ? 'font-semibold text-accent' : 'text-digi-text'}`} style={mf}>{t.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjuntos */}
      {(detail.attachments?.length ?? 0) > 0 && (
        <div className="pt-2 border-t border-digi-border">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Adjuntos ({detail.attachments!.length})</p>
          <div className="space-y-1">
            {detail.attachments!.map((a) => (
              <a key={a.id} href={`/api/reminders/${detail.id}/attachments/${a.id}`} onClick={alDescargar ? (e) => { e.preventDefault(); alDescargar(a); } : undefined}
                className="flex items-center gap-2 px-2 py-1 border border-digi-border rounded bg-digi-darker hover:border-accent transition-colors group">
                <Paperclip className="w-3.5 h-3.5 text-digi-muted shrink-0" />
                <span className="flex-1 text-[12px] text-digi-text truncate" style={mf}>{a.filename}{a.kind === 'transcript' ? ' · transcripción' : ''}</span>
                <Download className="w-3.5 h-3.5 text-digi-muted group-hover:text-accent shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** UNA fila (regla «PieAcciones», Fernando 2026-10-31): papelera sola a la izquierda;
 *  Editar y, a la derecha del todo, completar o reactivar. */
export function AccionesDetalle({ detail, alEliminar, alEditar, alCambiarEstado }: {
  detail: Reminder; alEliminar: (id: number) => void; alEditar: (id: number) => void; alCambiarEstado: (id: number, s: 'done' | 'active') => void;
}) {
  return (
    <PieAcciones onEliminar={() => alEliminar(detail.id)} etiquetaEliminar="Eliminar recordatorio">
      <button onClick={() => alEditar(detail.id)} className={BTN_SECONDARY}>
        <Pencil className="w-4 h-4" /> Editar
      </button>
      {effStatus(detail) === 'done' ? (
        <button onClick={() => alCambiarEstado(detail.id, 'active')} className={BTN_PRIMARY}>
          <RotateCcw className="w-4 h-4" /> Reactivar
        </button>
      ) : (
        <button onClick={() => alCambiarEstado(detail.id, 'done')} className={BTN_PRIMARY}>
          <CheckCircle2 className="w-4 h-4" /> Completar
        </button>
      )}
    </PieAcciones>
  );
}
