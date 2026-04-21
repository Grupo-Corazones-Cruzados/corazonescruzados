'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventDetailsModal from '@/components/calendar/EventDetailsModal';
import ProposalModal, { type ProposalPayload } from '@/components/calendar/ProposalModal';
import {
  type CalendarEvent,
  type EventInstance,
  expandEvents,
  MONTH_LABELS_ES,
} from '@/lib/calendar/recurrence';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;

export default function PublicCalendarPage() {
  const params = useParams<{ memberId: string }>();
  const search = useSearchParams();
  const token = search.get('token') || '';
  const memberId = params.memberId;

  const [view, setView] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [memberName, setMemberName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<EventInstance | null>(null);

  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setMe({ id: data.user.id, email: data.user.email });
      })
      .finally(() => setMeLoaded(true));
  }, []);

  const submitProposal = async (payload: ProposalPayload) => {
    const res = await fetch(`/api/members/calendar/public/${memberId}/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al enviar propuesta');
    await load();
  };

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
      setEvents(data.events || []);
      setError(null);
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
      <div className="min-h-screen flex items-center justify-center bg-digi-dark">
        <div className="text-[12px] text-digi-muted" style={pf}>Cargando calendario…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-digi-dark p-6">
        <div className="pixel-card max-w-md w-full text-center space-y-2">
          <div className="text-sm text-red-400" style={pf}>ENLACE NO DISPONIBLE</div>
          <div className="text-[11px] text-digi-muted">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-digi-dark p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="pixel-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] text-digi-muted" style={pf}>CALENDARIO PÚBLICO</div>
              <div className="text-lg text-accent-glow" style={pf}>{memberName}</div>
            </div>
            <div className="text-[10px] text-digi-muted" style={pf}>GMT-5 · Ecuador</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors"
                style={pf}
              >
                HOY
              </button>
              <button onClick={goPrev} className="w-8 h-8 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent" style={pf}>&lt;</button>
              <button onClick={goNext} className="w-8 h-8 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent" style={pf}>&gt;</button>
              <div className="text-sm text-accent-glow px-2" style={pf}>{label}</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex border-2 border-digi-border">
                {(['month', 'week', 'day'] as CalendarViewMode[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-[10px] transition-colors ${
                      view === v ? 'bg-accent/20 text-accent-glow' : 'text-digi-muted hover:text-digi-text'
                    }`}
                    style={pf}
                  >
                    {v === 'month' ? 'MES' : v === 'week' ? 'SEMANA' : 'DÍA'}
                  </button>
                ))}
              </div>
              <BookingCTA
                meLoaded={meLoaded}
                me={me}
                onOpen={() => setProposalOpen(true)}
                returnUrl={typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''}
              />
            </div>
          </div>

          <div className="mt-4">
            <CalendarView
              view={view}
              currentDate={currentDate}
              instances={instances}
              onDayClick={() => {}}
              onEventClick={(ev) => setDetail(ev)}
            />
          </div>
        </div>

        <div className="pixel-card">
          <div className="text-[10px] text-accent-glow mb-2" style={pf}>SUSCRIBIRSE A ACTUALIZACIONES</div>
          <p className="text-[11px] text-digi-muted mb-3">
            Recibe un correo cuando {memberName} agregue, modifique o elimine un evento.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="tu@correo.com"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              disabled={subscribing}
              className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button
              onClick={submitSubscribe}
              disabled={subscribing}
              className="px-4 py-2 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors disabled:opacity-50"
              style={pf}
            >
              {subscribing ? 'ENVIANDO…' : 'SUSCRIBIRME'}
            </button>
          </div>
          {subscribeMsg && (
            <div
              className={`mt-2 text-[10px] px-3 py-2 border ${
                subscribeMsg.kind === 'ok'
                  ? 'border-green-500/40 text-green-400 bg-green-950/20'
                  : 'border-red-500/40 text-red-400 bg-red-950/20'
              }`}
              style={pf}
            >
              {subscribeMsg.text}
            </div>
          )}
        </div>
      </div>

      <EventDetailsModal
        open={!!detail}
        onClose={() => setDetail(null)}
        event={detail}
      />

      <ProposalModal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        onSubmit={submitProposal}
        memberName={memberName || 'el miembro'}
      />
    </div>
  );
}

function BookingCTA({
  meLoaded,
  me,
  onOpen,
  returnUrl,
}: {
  meLoaded: boolean;
  me: { id: string; email: string | null } | null;
  onOpen: () => void;
  returnUrl: string;
}) {
  if (!meLoaded) return null;

  if (!me) {
    return (
      <a
        href={`/auth?redirect=${encodeURIComponent(returnUrl)}`}
        className="px-3 py-1.5 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors"
        style={pf}
      >
        REGISTRARSE PARA AGENDAR
      </a>
    );
  }

  if (!me.email) {
    return (
      <span
        className="px-3 py-1.5 text-[10px] border-2 border-amber-500/50 text-amber-400 bg-amber-950/20"
        style={pf}
        title="Agrega un correo a tu cuenta para poder agendar"
      >
        FALTA CORREO EN TU CUENTA
      </span>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="px-3 py-1.5 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors"
      style={pf}
    >
      + AGENDAR ESPACIO
    </button>
  );
}
