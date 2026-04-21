'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventModal, { type EventFormPayload, type ClientOption } from '@/components/calendar/EventModal';
import ShareDialog from '@/components/calendar/ShareDialog';
import ProposalsPanel from '@/components/calendar/ProposalsPanel';
import {
  type CalendarEvent,
  type EventInstance,
  expandEvents,
  MONTH_LABELS_ES,
} from '@/lib/calendar/recurrence';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;

export default function CalendarSettingsPage() {
  const [view, setView] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, clRes] = await Promise.all([
        fetch('/api/members/calendar/events'),
        fetch('/api/clients'),
      ]);
      const evData = await evRes.json();
      const clData = await clRes.json();
      setEvents(evData.data || []);
      setClients((clData.data || []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      toast.error('Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const range = useMemo(() => {
    if (view === 'month') {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      s.setDate(1 - s.getDay());
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(s.getDate() + 42);
      return { s, e };
    }
    if (view === 'week') {
      const s = new Date(currentDate);
      s.setDate(s.getDate() - s.getDay());
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(s.getDate() + 7);
      return { s, e };
    }
    const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 1);
    return { s, e };
  }, [view, currentDate]);

  const instances: EventInstance[] = useMemo(
    () => expandEvents(events, range.s, range.e),
    [events, range],
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
  const goToday = () => setCurrentDate(new Date());

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

  const handleDayClick = (date: Date) => {
    setEditingEvent(null);
    setInitialDate(date);
    setModalOpen(true);
  };
  const handleEventClick = (inst: EventInstance) => {
    const full = events.find((e) => e.id === inst.id) || null;
    setEditingEvent(full);
    setInitialDate(null);
    setModalOpen(true);
  };

  const handleSave = async (payload: EventFormPayload, id?: string) => {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `/api/members/calendar/events/${id}` : '/api/members/calendar/events';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error al guardar');
    }
    toast.success(id ? 'Evento actualizado' : 'Evento creado');
    await load();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/members/calendar/events/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Error al eliminar');
      return;
    }
    toast.success('Evento eliminado');
    await load();
  };

  return (
    <div className="max-w-6xl">
      <PageHeader title="Calendario" description="Organiza tus eventos laborales y personales" />

      <div className="pixel-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors"
              style={pf}
            >
              HOY
            </button>
            <button
              onClick={goPrev}
              className="w-8 h-8 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors"
              style={pf}
              aria-label="Anterior"
            >
              &lt;
            </button>
            <button
              onClick={goNext}
              className="w-8 h-8 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors"
              style={pf}
              aria-label="Siguiente"
            >
              &gt;
            </button>
            <div className="text-sm text-accent-glow px-2" style={pf}>{label}</div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border-2 border-digi-border">
              {(['month', 'week', 'day'] as CalendarViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-[10px] transition-colors ${
                    view === v
                      ? 'bg-accent/20 text-accent-glow'
                      : 'text-digi-muted hover:text-digi-text'
                  }`}
                  style={pf}
                >
                  {v === 'month' ? 'MES' : v === 'week' ? 'SEMANA' : 'DÍA'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="px-3 py-1.5 text-[10px] border-2 border-digi-border text-digi-text hover:border-accent transition-colors"
              style={pf}
            >
              COMPARTIR
            </button>
            <button
              onClick={() => { setEditingEvent(null); setInitialDate(new Date()); setModalOpen(true); }}
              className="px-3 py-1.5 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors"
              style={pf}
            >
              + NUEVO
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[10px] text-digi-muted" style={pf}>
            Cargando…
          </div>
        ) : (
          <CalendarView
            view={view}
            currentDate={currentDate}
            instances={instances}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        )}

        <div className="flex gap-4 text-[10px] text-digi-muted pt-2" style={pf}>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-l-2" style={{ borderLeftColor: '#7B5FBF', backgroundColor: '#7B5FBF30' }} />
            LABORAL
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 border-l-2" style={{ borderLeftColor: '#22c55e', backgroundColor: '#22c55e30' }} />
            PERSONAL
          </div>
          <div className="ml-auto">Zona horaria: América/Guayaquil (GMT-5)</div>
        </div>
      </div>

      <ProposalsPanel onDecision={load} />

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        event={editingEvent}
        initialDate={initialDate}
        clients={clients}
      />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
