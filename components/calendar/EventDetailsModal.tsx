'use client';

import PixelModal from '@/components/ui/PixelModal';
import type { EventInstance } from '@/lib/calendar/recurrence';
import { colorForEvent, MONTH_LABELS_ES } from '@/lib/calendar/recurrence';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  event: EventInstance | null;
  hideClientName?: boolean;
  hideDescription?: boolean;
}

function fmtDateTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventDetailsModal({ open, onClose, event, hideClientName, hideDescription }: Props) {
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
            <div className="text-sm text-digi-text mb-1" style={pf}>{event.title}</div>
            <div className="text-[10px] text-digi-muted" style={pf}>
              {event.event_type === 'work' ? 'LABORAL' : 'PERSONAL'}
              {event.isRecurring && ' · RECURRENTE'}
            </div>
          </div>
        </div>

        <div className="pixel-card-inner border border-digi-border p-3 space-y-1.5 text-[11px]" style={mf}>
          <div className="flex justify-between gap-3">
            <span className="text-digi-muted">Inicio</span>
            <span className="text-digi-text">{fmtDateTime(event.instanceStart)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-digi-muted">Fin</span>
            <span className="text-digi-text">{fmtDateTime(event.instanceEnd)}</span>
          </div>
          {event.event_type === 'work' && event.client_name && !hideClientName && (
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
            <div className="text-[10px] text-accent-glow opacity-70 mb-1" style={pf}>COMENTARIO</div>
            <div className="text-[11px] text-digi-text whitespace-pre-wrap" style={mf}>
              {event.description}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-digi-border">
          <button
            onClick={onClose}
            className="px-3 py-2 text-[10px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors"
            style={pf}
          >
            CERRAR
          </button>
        </div>
      </div>
    </PixelModal>
  );
}
