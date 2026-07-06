'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, Plus, Share2, CalendarDays } from 'lucide-react';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventModal, { type EventFormPayload, type ClientOption } from '@/components/calendar/EventModal';
import ShareDialog from '@/components/calendar/ShareDialog';
import ProposalsPanel from '@/components/calendar/ProposalsPanel';
import {
  type CalendarEvent,
  type EventInstance,
  type EventType,
  expandEvents,
  MONTH_LABELS_ES,
  EVENT_COLORS,
} from '@/lib/calendar/recurrence';
import {
  type AvailabilityStatus,
  AVAILABILITY,
  AVAILABILITY_ORDER,
} from '@/lib/calendar/availability';

const mf = { fontFamily: 'var(--font-body)' } as const;

const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'day', label: 'Día' },
];

export default function CalendarSettingsPage() {
  const [view, setView] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [initialType, setInitialType] = useState<EventType>('work');
  const [shareOpen, setShareOpen] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityStatus>('conectado');
  const [savingAvail, setSavingAvail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, clRes, avRes] = await Promise.all([
        fetch('/api/members/calendar/events'),
        fetch('/api/clients'),
        fetch('/api/members/calendar/availability'),
      ]);
      const evData = await evRes.json();
      const clData = await clRes.json();
      setEvents(evData.data || []);
      setClients((clData.data || []).map((c: any) => ({ id: c.id, name: c.name })));
      if (avRes.ok) {
        const avData = await avRes.json();
        if (avData.status) setAvailability(avData.status);
      }
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
    setInitialType('work');
    setModalOpen(true);
  };

  const openNew = (type: EventType) => {
    setEditingEvent(null);
    setInitialDate(new Date());
    setInitialType(type);
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

  const changeAvailability = async (status: AvailabilityStatus) => {
    if (status === availability || savingAvail) return;
    setSavingAvail(true);
    const prev = availability;
    setAvailability(status);
    try {
      const res = await fetch('/api/members/calendar/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al actualizar disponibilidad');
      }
      toast.success(`Disponibilidad: ${AVAILABILITY[status].label}`);
      await load();
    } catch (err: any) {
      setAvailability(prev);
      toast.error(err?.message || 'Error al actualizar disponibilidad');
    } finally {
      setSavingAvail(false);
    }
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
    <div>
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}>
        <ChevronLeft className="w-4 h-4" /> Configuración
      </Link>
      <PageHeader title="Calendario" description="Organiza tus eventos y tareas laborales y personales" />

      <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
        {/* ── Command bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-digi-border">
          {/* Navegación */}
          <div className="flex items-center gap-2">
            <button onClick={goToday} className={`${BTN_SECONDARY} !py-1.5`}>Hoy</button>
            <div className="flex items-center gap-1">
              <button onClick={goPrev} aria-label="Anterior"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext} aria-label="Siguiente"
                className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[15px] font-semibold text-digi-text capitalize ml-1" style={mf}>{label}</span>
          </div>

          {/* Vistas + disponibilidad + acciones */}
          <div className="flex items-center gap-2">
            {/* Segmented: Mes / Semana / Día */}
            <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setView(v.value)}
                  className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    view === v.value ? 'bg-accent text-white' : 'text-digi-muted hover:bg-black/[0.03]'
                  }`}
                  style={mf}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Disponibilidad */}
            <div className="inline-flex items-center gap-1.5 rounded-md border border-digi-border pl-2.5 pr-1.5 py-1" title="Tu disponibilidad">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AVAILABILITY[availability].color }} />
              <select
                value={availability}
                disabled={savingAvail}
                onChange={(e) => changeAvailability(e.target.value as AvailabilityStatus)}
                className="bg-transparent text-[12.5px] text-digi-text focus:outline-none cursor-pointer disabled:opacity-50"
                style={mf}
                aria-label="Disponibilidad"
              >
                {AVAILABILITY_ORDER.map((s) => (
                  <option key={s} value={s}>{AVAILABILITY[s].label}</option>
                ))}
              </select>
            </div>

            <button onClick={() => setShareOpen(true)} className={BTN_SECONDARY}>
              <Share2 className="w-4 h-4" /> Compartir
            </button>
            <button onClick={() => openNew('work')} className={BTN_PRIMARY}>
              <Plus className="w-4 h-4" /> Nuevo
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-digi-muted" style={mf}>
              <CalendarDays className="w-4 h-4 animate-pulse" /> Cargando…
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
        </div>

        {/* ── Leyenda ── */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-digi-border text-[12px] text-digi-muted" style={mf}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${EVENT_COLORS.work}30`, borderLeft: `3px solid ${EVENT_COLORS.work}` }} /> Laboral
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${EVENT_COLORS.personal}30`, borderLeft: `3px solid ${EVENT_COLORS.personal}` }} /> Personal
          </span>
          <span className="ml-auto tabular-nums">Zona horaria: América/Guayaquil (GMT-5)</span>
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
        initialType={initialType}
        clients={clients}
      />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
