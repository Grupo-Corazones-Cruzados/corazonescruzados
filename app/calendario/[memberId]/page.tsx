'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CalendarDays, ChevronLeft, ChevronRight, RefreshCw, CalendarPlus, Bell, Clock,
} from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventDetailsModal from '@/components/calendar/EventDetailsModal';
import ProposalModal, { type ProposalPayload } from '@/components/calendar/ProposalModal';
import {
  type CalendarEvent,
  type EventInstance,
  expandEvents,
  MONTH_LABELS_ES,
} from '@/lib/calendar/recurrence';
import { type AvailabilityStatus, AVAILABILITY } from '@/lib/calendar/availability';

// Dashboard Fluent (.corp): ambas fuentes resuelven a Segoe UI.
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

// Color neutro de los bloques "Ocupado" (coincide con el del endpoint público).
const BUSY_COLOR = '#64748b';

const MEMBER_TZ = 'America/Guayaquil';

// Devuelve un Date cuya hora LOCAL coincide con la hora de Ecuador del instante dado.
// Sirve para "forzar" que la grilla (que pinta con hora local) muestre horario de Ecuador.
function toEcuadorClock(d: Date): Date {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: MEMBER_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return new Date(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
}

const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' },
];

export default function PublicCalendarPage() {
  const params = useParams<{ memberId: string }>();
  const search = useSearchParams();
  const token = search.get('token') || '';
  const memberId = params.memberId;

  const [view, setView] = useState<CalendarViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [memberName, setMemberName] = useState<string>('');
  const [memberStatus, setMemberStatus] = useState<AvailabilityStatus>('conectado');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const syncKey = `calsync:${memberId}`;

  // Muestra la última sincronización previa (de otra visita) hasta que
  // la carga automática traiga datos frescos.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(syncKey);
    if (saved) {
      const d = new Date(saved);
      if (!Number.isNaN(d.getTime())) setLastSync(d);
    }
  }, [syncKey]);

  const fmtSync = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getDate()} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [detail, setDetail] = useState<EventInstance | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  // Fecha/hora inicial cuando se abre el formulario desde un clic en la grilla.
  const [proposalStart, setProposalStart] = useState<Date | null>(null);
  // Reservas creadas en ESTA sesión (id → correo del visitante). Solo estas se pueden
  // ver en detalle y cancelar; al recargar se pierden (el resto son "Ocupado" confidencial).
  const [ownProposals, setOwnProposals] = useState<Map<string, string>>(new Map());
  const [canceling, setCanceling] = useState(false);

  const submitProposal = async (payload: ProposalPayload) => {
    const res = await fetch(`/api/members/calendar/public/${memberId}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al enviar propuesta');
    // El evento propuesto se muestra TEMPORALMENTE con su título real (solo para quien lo
    // creó), agregándolo al estado local sin recargar. Al recargar la página, el endpoint
    // público lo devuelve como "Ocupado" (confidencialidad de los eventos del miembro).
    const id = data.id || `local-${Date.now()}`;
    const localEvent: CalendarEvent = {
      id,
      title: payload.title,
      description: payload.description,
      event_type: 'progreso',
      client_id: null,
      client_name: null,
      start_at: payload.start_at,
      end_at: payload.end_at,
      all_day: false,
      timezone: payload.timezone,
      recurrence_type: payload.recurrence_type,
      recurrence_days: payload.recurrence_days,
      recurrence_interval: payload.recurrence_interval,
      recurrence_until: payload.recurrence_until,
      color: null,
      status: 'proposed',
    };
    setEvents((prev) => [...prev, localEvent]);
    setOwnProposals((m) => new Map(m).set(id, payload.guest_email));
  };

  // Cancelar una reserva PROPIA (aún pendiente, en esta sesión).
  const cancelProposal = async (ev: EventInstance) => {
    const guestEmail = ownProposals.get(ev.id);
    if (!guestEmail) return;
    setCanceling(true);
    try {
      const res = await fetch(`/api/members/calendar/public/${memberId}/propose`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, eventId: ev.id, guest_email: guestEmail }),
      });
      if (!res.ok) throw new Error();
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      setOwnProposals((m) => { const n = new Map(m); n.delete(ev.id); return n; });
      setDetail(null);
    } catch {
      /* si falla, se deja el detalle abierto para reintentar */
    } finally {
      setCanceling(false);
    }
  };

  // Clic en un evento: solo se abre el detalle si es una reserva PROPIA de esta sesión;
  // los bloques "Ocupado" del miembro son confidenciales (no se abren).
  const onEventClick = (ev: EventInstance) => {
    if (ownProposals.has(ev.id)) setDetail(ev);
  };

  // Clic en la grilla (zona libre) → abre el formulario con esa fecha/hora prellenada.
  const onGridClick = (date: Date) => {
    // La grilla ya muestra horario de Ecuador; las partes locales del clic representan esa
    // hora, que el formulario interpreta como Ecuador. En vista Mes (clic de día a medianoche)
    // se usa una hora por defecto razonable.
    const d = new Date(date);
    if (view === 'month') d.setHours(10, 0, 0, 0);
    setProposalStart(d);
    setProposalOpen(true);
  };

  // ¿El rango [startMs,endMs) choca con algún evento del miembro? (para bloquear en el form)
  const isBusy = useCallback((startMs: number, endMs: number) => {
    const dayStart = new Date(startMs); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    return expandEvents(events, dayStart, dayEnd)
      .some((ev) => ev.instanceStart.getTime() < endMs && ev.instanceEnd.getTime() > startMs);
  }, [events]);

  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submitSubscribe = async () => {
    const email = subscribeEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubscribeMsg({ kind: 'err', text: 'Ingresa un correo válido' });
      return;
    }
    setSubscribing(true);
    setSubscribeMsg(null);
    try {
      const res = await fetch(`/api/members/calendar/public/${memberId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Error al suscribir');
      setSubscribeMsg({ kind: 'ok', text: 'Revisa tu correo para confirmar la suscripción.' });
      setSubscribeEmail('');
    } catch (err: any) {
      setSubscribeMsg({ kind: 'err', text: err?.message || 'Error al suscribir' });
    } finally {
      setSubscribing(false);
    }
  };

  const load = useCallback(async () => {
    if (!token) { setError('Falta el token de acceso'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/members/calendar/public/${memberId}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Enlace inválido');
      }
      const data = await res.json();
      setMemberName(data.member?.name || 'Miembro');
      setMemberStatus(data.member?.availability_status || 'conectado');
      setEvents(data.events || []);
      setError(null);
      const now = new Date();
      setLastSync(now);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`calsync:${memberId}`, now.toISOString());
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [memberId, token]);

  useEffect(() => { load(); }, [load]);

  const range = useMemo(() => {
    if (view === 'month') {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      s.setDate(1 - s.getDay());
      s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(s.getDate() + 42);
      return { s, e };
    }
    if (view === 'week') {
      const s = new Date(currentDate);
      s.setDate(s.getDate() - s.getDay());
      s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(s.getDate() + 7);
      return { s, e };
    }
    const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 1);
    return { s, e };
  }, [view, currentDate]);

  const instances = useMemo(() => expandEvents(events, range.s, range.e), [events, range]);

  // El calendario público SIEMPRE se muestra en horario del miembro (Ecuador, GMT-5),
  // independientemente de la zona del visitante. Para lograrlo sin tocar el componente
  // compartido, se "desplazan" las instancias para que su hora local coincida con la de
  // Ecuador (así la grilla, que pinta con la hora local del navegador, muestra Ecuador).
  const displayInstances = useMemo(
    () => instances.map((i) => ({ ...i, instanceStart: toEcuadorClock(i.instanceStart), instanceEnd: toEcuadorClock(i.instanceEnd) })),
    [instances],
  );

  const goPrev = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (view === 'month') d.setMonth(d.getMonth() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const label = useMemo(() => {
    const m = MONTH_LABELS_ES[currentDate.getMonth()];
    const y = currentDate.getFullYear();
    if (view === 'month') return `${m} ${y}`;
    if (view === 'week') {
      const s = new Date(currentDate); s.setDate(s.getDate() - s.getDay());
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return `${s.getDate()} ${MONTH_LABELS_ES[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTH_LABELS_ES[e.getMonth()].slice(0, 3)} ${y}`;
    }
    return `${currentDate.getDate()} ${m} ${y}`;
  }, [view, currentDate]);

  if (loading) {
    return (
      <div className="corp min-h-screen flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-[13px] text-digi-muted" style={mf}>
          <CalendarDays className="w-4 h-4 animate-pulse" /> Cargando calendario…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="corp min-h-screen flex items-center justify-center p-6">
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-6 max-w-md w-full text-center space-y-1.5">
          <div className="text-[15px] font-semibold text-digi-text" style={df}>Enlace no disponible</div>
          <div className="text-[13px] text-digi-muted" style={mf}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="corp min-h-screen py-6 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
          {/* Encabezado: miembro + disponibilidad + zona horaria/última sincronización */}
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-digi-border">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Calendario público</div>
              <h1 className="text-[20px] font-semibold text-digi-text flex items-center gap-2 mt-0.5" style={df}>
                <CalendarDays className="w-5 h-5 text-accent shrink-0" /> <span className="min-w-0 break-words">{memberName}</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AVAILABILITY[memberStatus].color }} />
                <span className="text-[12px] text-digi-muted" style={mf}>{AVAILABILITY[memberStatus].label}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[12px] text-digi-muted inline-flex items-center gap-1" style={mf}>
                <Clock className="w-3.5 h-3.5" /> GMT-5 · Ecuador
              </div>
              <div className="text-[11px] text-digi-muted mt-1" style={mf}>
                {lastSync ? `Actualizado: ${fmtSync(lastSync)}` : 'Sin sincronizar'}
              </div>
            </div>
          </div>

          {/* Command bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-digi-border">
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentDate(new Date())} className={`${BTN_SECONDARY} !py-1.5`}>Hoy</button>
              <div className="flex items-center gap-1">
                <button onClick={goPrev} aria-label="Anterior" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={goNext} aria-label="Siguiente" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <span className="text-[15px] font-semibold text-digi-text capitalize ml-1" style={mf}>{label}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
                {VIEWS.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => setView(v.value)}
                    className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${view === v.value ? 'bg-accent text-white' : 'text-digi-muted hover:bg-black/[0.03]'}`}
                    style={mf}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => load()}
                disabled={loading}
                className={`${BTN_SECONDARY} !py-1.5`}
                title={lastSync ? `Última actualización: ${fmtSync(lastSync)}` : 'Sincronizar calendario'}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Sincronizando…' : 'Sincronizar'}
              </button>
              <button onClick={() => { setProposalStart(null); setProposalOpen(true); }} className={BTN_PRIMARY}>
                <CalendarPlus className="w-4 h-4" /> Agendar espacio
              </button>
            </div>
          </div>

          {/* Grid — clic en zona libre abre el formulario con esa hora; clic en un bloque
              ocupado no muestra detalle (confidencial), salvo tu propia reserva reciente */}
          <div className="p-3">
            <CalendarView
              view={view}
              currentDate={currentDate}
              instances={displayInstances}
              onDayClick={onGridClick}
              onEventClick={onEventClick}
            />
          </div>

          {/* Leyenda — el calendario público es libre/ocupado (sin exponer el detalle de los eventos) */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-digi-border text-[12px] text-digi-muted" style={mf}>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${BUSY_COLOR}30`, borderLeft: `3px solid ${BUSY_COLOR}` }} /> Ocupado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f59e0b1f', borderLeft: '3px dashed #f59e0b' }} /> Tu propuesta (pendiente)
            </span>
            <span className="ml-auto">Solo se muestran las franjas ocupadas, no el detalle de los eventos.</span>
          </div>
        </div>

        {/* Suscripción a actualizaciones */}
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4">
          <div className="text-[13px] font-semibold text-digi-text inline-flex items-center gap-2" style={df}>
            <Bell className="w-4 h-4 text-accent" /> Suscribirse a actualizaciones
          </div>
          <p className="text-[12.5px] text-digi-muted mt-1 mb-3" style={mf}>
            Recibe un correo cuando {memberName} agregue, modifique o elimine un evento.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="tu@correo.com"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              disabled={subscribing}
              className="field-control flex-1 rounded-md text-sm text-digi-text focus:outline-none disabled:opacity-60"
              style={mf}
            />
            <button onClick={submitSubscribe} disabled={subscribing} className={BTN_PRIMARY}>
              {subscribing ? 'Enviando…' : 'Suscribirme'}
            </button>
          </div>
          {subscribeMsg && (
            <div
              className={`mt-2 text-[12px] px-3 py-2 rounded-md border ${
                subscribeMsg.kind === 'ok'
                  ? 'border-green-300 text-green-700 bg-green-50'
                  : 'border-red-300 text-red-600 bg-red-50'
              }`}
              style={mf}
            >
              {subscribeMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* El detalle solo se abre para reservas PROPIAS de esta sesión → muestra el dato
          real y permite cancelarla (mientras no se recargue la página). */}
      <EventDetailsModal
        open={!!detail}
        onClose={() => setDetail(null)}
        event={detail}
        onCancel={detail ? () => cancelProposal(detail) : undefined}
        canceling={canceling}
      />

      <ProposalModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        onSubmit={submitProposal}
        memberName={memberName || 'el miembro'}
        initialStart={proposalStart}
        isBusy={isBusy}
      />
    </div>
  );
}
