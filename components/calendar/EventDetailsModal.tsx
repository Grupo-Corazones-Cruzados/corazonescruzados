'use client';

import PixelModal from '@/components/ui/PixelModal';
import { Repeat } from 'lucide-react';
import type { EventInstance } from '@/lib/calendar/recurrence';
import { colorForEvent, MONTH_LABELS_ES } from '@/lib/calendar/recurrence';

const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  event: EventInstance | null;
  hideClientName?: boolean;
  hideDescription?: boolean;
  /** Oculta la categoría (Progreso/Personal): calendario público confidencial. */
  hideType?: boolean;
}

function fmtDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventDetailsModal({ open, onClose, event, hideClientName, hideDescription, hideType }: Props) {
  if (!event) return null;
  const color = colorForEvent(event);

  return (
    <PixelModal open={open} onClose={onClose} title="Detalle del evento" size="md">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            className="w-1 self-stretch rounded-sm"
            style={{ backgroundColor: color, minHeight: 48 }}
          />
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-digi-text mb-1" style={pf}>{event.title}</div>
            {(!hideType || event.isRecurring) && (
              <div className="flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
                {!hideType && (event.event_type === 'progreso' ? 'Progreso' : 'Personal')}
                {event.isRecurring && (
                  <>
                    {!hideType && <span>·</span>}
                    <Repeat className="w-3.5 h-3.5" /> Recurrente
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-digi-border bg-digi-darker p-3 space-y-1.5 text-[13px]" style={mf}>
          <div className="flex justify-between gap-3">
            <span className="text-digi-muted">Inicio</span>
            <span className="text-digi-text">{fmtDateTime(event.instanceStart)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-digi-muted">Fin</span>
            <span className="text-digi-text">{fmtDateTime(event.instanceEnd)}</span>
          </div>
          {event.event_type === 'progreso' && event.client_name && !hideClientName && (
            <div className="flex justify-between gap-3">
              <span className="text-digi-muted">Cliente</span>
              <span className="text-digi-text">{event.client_name}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-digi-muted">Zona horaria</span>
            <span className="text-digi-text">{event.timezone}</span>
          </div>
        </div>

        {event.description && !hideDescription && (
          <div>
            <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Comentario</div>
            <div className="text-[13px] text-digi-text whitespace-pre-wrap" style={mf}>
              {event.description}
            </div>
          </div>
        )}
      </div>
    </PixelModal>
  );
}
