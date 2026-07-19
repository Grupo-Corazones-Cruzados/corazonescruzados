'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { VALOR_LABEL } from '@/lib/centralized/valores';
import {
  Layers, Megaphone, PlayCircle, CheckCircle2, CalendarDays, MapPin, Clock, Users,
  Gem, Sparkles, PartyPopper, XCircle, Lock, ChevronLeft,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type EventStatus = 'draft' | 'published' | 'active' | 'finished' | 'cancelled';
type SignupStatus = 'pending' | 'completed' | 'failed';

interface EventTask {
  id: number; title: string; detail: string; values: string[]; talents: string[];
  plazas: number; taken: number; free: number; startTime: string | null; endTime: string | null;
  signups?: { name: string; status: SignupStatus }[];
  mine?: { id: number; status: SignupStatus } | null;
}
interface SocialEvent {
  id: number; name: string; description: string; location: string; eventDate: string;
  startTime: string | null; endTime: string | null; allDay: boolean; status: EventStatus;
  taskCount: number; plazasTotal: number; plazasTaken: number;
  tasks?: EventTask[]; myTaskId?: number | null;
}

const STATUS_META: Record<EventStatus, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-black/[0.05] text-digi-muted border-digi-border' },
  published: { label: 'Abierto', cls: 'bg-accent-light text-accent border-accent/30' },
  active: { label: 'En curso', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-400/40' },
  finished: { label: 'Finalizado', cls: 'bg-sky-500/15 text-sky-600 border-sky-400/40' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-600 border-red-400/40' },
};

const FILTERS: FilterRailItem<string>[] = [
  { value: 'all', label: 'Todas', Icon: Layers },
  { value: 'published', label: 'Abiertas', Icon: Megaphone },
  { value: 'active', label: 'En curso', Icon: PlayCircle },
  { value: 'mine', label: 'Mis experiencias', Icon: CheckCircle2 },
  { value: 'finished', label: 'Finalizadas', Icon: CheckCircle2 },
];

const fmtDate = (ymd: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};
const timeLabel = (e: { allDay: boolean; startTime: string | null; endTime: string | null }) =>
  e.allDay || !e.startTime ? 'Todo el día' : `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}`;

/**
 * Módulo "Experiencias": el miembro (o candidato) ve los eventos abiertos del sistema
 * Gestión Social, entra a uno, revisa sus tareas y TOMA una si quedan plazas. Al confirmar,
 * la tarea se agenda automáticamente en su "Mi día" — bloqueada hasta que el organizador
 * marque el inicio del evento.
 *
 * Regla: una sola tarea por evento; se puede soltar mientras el evento no haya iniciado.
 */
export default function ExperienciasPage() {
  const [filter, setFilter] = useState('all');
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SocialEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/experiencias');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEvents(j.data.events || []);
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/experiencias/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDetail(j.data.event);
      setErr(null);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (openId != null) loadDetail(openId); else setDetail(null); }, [openId, loadDetail]);

  const act = async (fn: () => Promise<Response>) => {
    setBusy(true);
    try {
      const res = await fn();
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo completar la acción.');
      setErr(null);
      await load();
      if (openId != null) await loadDetail(openId);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const counts = useMemo(() => ({
    all: events.length,
    published: events.filter((e) => e.status === 'published').length,
    active: events.filter((e) => e.status === 'active').length,
    finished: events.filter((e) => e.status === 'finished').length,
    mine: events.filter((e) => e.myTaskId != null).length,
  }), [events]);

  const visible = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'mine') return events.filter((e) => e.myTaskId != null);
    return events.filter((e) => e.status === filter);
  }, [events, filter]);

  const railItems = useMemo(
    () => FILTERS.map((f) => ({ ...f, count: (counts as any)[f.value] })),
    [counts],
  );

  // ── Detalle de una experiencia (drill-in) ──
  if (detail) {
    return (
      <div>
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-4" style={mf}>
          <ChevronLeft className="w-4 h-4" /> Experiencias
        </button>
        {err && <ErrorBanner text={err} />}
        <EventDetail
          event={detail}
          busy={busy}
          onTake={(t) => setConfirm({
            text: `¿Confirmas que tomarás la tarea "${t.title}"? Se agendará en tu Mi día el ${fmtDate(detail.eventDate)} y podrás marcar su estado cuando el evento inicie.`,
            onOk: () => act(() => fetch(`/api/experiencias/tareas/${t.id}`, { method: 'POST' })),
          })}
          onRelease={(t) => setConfirm({
            text: `¿Soltar la tarea "${t.title}"? Liberarás tu plaza y se quitará de tu Mi día.`,
            onOk: () => act(() => fetch(`/api/experiencias/tareas/${t.id}`, { method: 'DELETE' })),
          })}
        />
        <PixelConfirm
          open={!!confirm}
          message={confirm?.text || ''}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }}
        />
      </div>
    );
  }

  // ── Lista de experiencias ──
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <FilterRail title="Experiencias" items={railItems} value={filter} onChange={setFilter} />

      <div className="flex-1 min-w-0 w-full">
        {err && <ErrorBanner text={err} />}
        {loading ? (
          <p className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
        ) : visible.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
            <PartyPopper className="w-8 h-8 text-digi-muted mx-auto mb-2" />
            <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin experiencias por ahora</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Cuando se publique un evento, aparecerá aquí para que puedas participar.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((e) => (
              <button
                key={e.id}
                onClick={() => setOpenId(e.id)}
                className="text-left bg-digi-card border border-digi-border rounded-lg p-3.5 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-digi-text" style={df}>{e.name}</span>
                  <StatusBadge status={e.status} />
                  {e.myTaskId != null && (
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full border bg-accent-light border-accent/30 text-accent" style={mf}>Participas</span>
                  )}
                </div>
                {e.description && <p className="text-[12px] text-digi-muted mt-1.5 line-clamp-2" style={mf}>{e.description}</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap text-[11.5px] text-digi-muted" style={mf}>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(e.eventDate)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeLabel(e)}</span>
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {e.location}</span>}
                </div>
                <div className="mt-2 text-[11.5px] text-digi-muted inline-flex items-center gap-1" style={mf}>
                  <Users className="w-3.5 h-3.5" /> {Math.max(0, e.plazasTotal - e.plazasTaken)} plaza(s) libre(s) de {e.plazasTotal}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventDetail({ event, busy, onTake, onRelease }: {
  event: SocialEvent; busy: boolean;
  onTake: (t: EventTask) => void; onRelease: (t: EventTask) => void;
}) {
  const open = event.status === 'published';
  const mineTask = (event.tasks || []).find((t) => t.mine);

  return (
    <div>
      <div className="bg-digi-card border border-digi-border rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[17px] font-semibold text-digi-text" style={df}>{event.name}</h1>
          <StatusBadge status={event.status} />
        </div>
        {event.description && <p className="text-[13px] text-digi-muted mt-2 whitespace-pre-wrap" style={mf}>{event.description}</p>}
        <div className="flex items-center gap-4 mt-3 flex-wrap text-[12px] text-digi-muted" style={mf}>
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {fmtDate(event.eventDate)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4" /> {timeLabel(event)}</span>
          {event.location && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>}
        </div>

        {mineTask && (
          <div className="mt-3 px-3 py-2 rounded-md border border-accent/30 bg-accent-light text-[12px] text-accent flex items-start gap-2" style={mf}>
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Participas con la tarea «{mineTask.title}». Ya está agendada en tu <strong>Mi día</strong>.
              {event.status === 'published' && ' Podrás marcar si la completaste cuando el organizador inicie el evento.'}
            </span>
          </div>
        )}
        {event.status === 'finished' && (
          <p className="mt-3 text-[12px] text-digi-muted" style={mf}>Este evento ya finalizó. El resultado de tu tarea quedó registrado en tu perfil.</p>
        )}
      </div>

      <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mt-5 mb-2" style={df}>Tareas del evento</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(event.tasks || []).map((t) => {
          const mine = !!t.mine;
          // Solo se puede tomar si el evento sigue abierto, quedan plazas y no participo ya.
          const canTake = open && !mineTask && t.free > 0;
          return (
            <div key={t.id} className={`bg-digi-card border rounded-lg p-3.5 ${mine ? 'border-accent' : 'border-digi-border'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-digi-text" style={mf}>{t.title}</p>
                  {t.detail && <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{t.detail}</p>}
                </div>
                <span className={`text-[10.5px] px-2 py-0.5 rounded-full tabular-nums shrink-0 border ${t.free === 0 ? 'bg-red-500/15 border-red-400/40 text-red-600' : 'bg-black/[0.05] border-digi-border text-digi-muted'}`} style={mf}>
                  {t.free > 0 ? `${t.free} libre(s)` : 'Sin plazas'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {t.startTime && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/[0.05] border border-digi-border text-[10.5px] text-digi-muted" style={mf}>
                    <Clock className="w-3 h-3" /> {t.startTime}{t.endTime ? `–${t.endTime}` : ''}
                  </span>
                )}
                {t.values.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10.5px] text-violet-500" style={mf}>
                    <Gem className="w-3 h-3" /> {VALOR_LABEL[v] || v}
                  </span>
                ))}
                {t.talents.map((tal) => (
                  <span key={tal} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10.5px] text-sky-600" style={mf}>
                    <Sparkles className="w-3 h-3" /> {tal}
                  </span>
                ))}
              </div>

              <div className="mt-3">
                {mine ? (
                  open ? (
                    <button className={BTN_SECONDARY} onClick={() => onRelease(t)} disabled={busy} style={mf}>Soltar tarea</button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
                      <Lock className="w-3.5 h-3.5" /> Tu tarea (ya no se puede soltar)
                    </span>
                  )
                ) : canTake ? (
                  <button className={BTN_PRIMARY} onClick={() => onTake(t)} disabled={busy} style={mf}>Tomar y confirmar asistencia</button>
                ) : (
                  <span className="text-[11.5px] text-digi-muted" style={mf}>
                    {!open ? 'El evento ya no admite inscripciones.' : mineTask ? 'Ya tomaste otra tarea de este evento.' : 'Sin plazas disponibles.'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return <span className={`inline-block text-[10.5px] px-2 py-0.5 rounded-full border ${m.cls}`} style={mf}>{m.label}</span>;
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
      <XCircle className="w-4 h-4 shrink-0" /> {text}
    </div>
  );
}
