'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelConfirm from '@/components/ui/PixelConfirm';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import { VALORES, VALOR_LABEL } from '@/lib/centralized/valores';
import { TALENTOS } from '@/lib/centralized/talentos';
import {
  Layers, FileEdit, Megaphone, PlayCircle, CheckCircle2, XCircle, Plus, Trash2, Pencil,
  CalendarDays, MapPin, Clock, Users, Gem, Sparkles, PartyPopper, Square, Info,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const API = '/api/centralized/gestion-social';
const VALOR_OPTIONS = VALORES.map((v) => ({ value: v.key, label: v.label }));
const TALENTO_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));

type EventStatus = 'draft' | 'published' | 'active' | 'finished' | 'cancelled';
type SignupStatus = 'pending' | 'completed' | 'failed';

interface Signup { id: number; subjectKind: string; subjectId: string; name: string; status: SignupStatus }
interface EventTask {
  id: number; eventId: number; title: string; detail: string; values: string[]; talents: string[];
  plazas: number; taken: number; free: number; startTime: string | null; endTime: string | null;
  signups?: Signup[];
}
interface SocialEvent {
  id: number; name: string; description: string; location: string; eventDate: string;
  startTime: string | null; endTime: string | null; allDay: boolean; status: EventStatus;
  startedAt: string | null; endedAt: string | null;
  taskCount: number; plazasTotal: number; plazasTaken: number; tasks?: EventTask[];
}

const STATUS_META: Record<EventStatus, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-black/[0.05] text-digi-muted border-digi-border' },
  published: { label: 'Publicado', cls: 'bg-accent-light text-accent border-accent/30' },
  active: { label: 'En curso', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-400/40' },
  finished: { label: 'Finalizado', cls: 'bg-sky-500/15 text-sky-600 border-sky-400/40' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-600 border-red-400/40' },
};

const FILTERS: FilterRailItem<string>[] = [
  { value: 'all', label: 'Todos', Icon: Layers },
  { value: 'draft', label: 'Borradores', Icon: FileEdit },
  { value: 'published', label: 'Publicados', Icon: Megaphone },
  { value: 'active', label: 'En curso', Icon: PlayCircle },
  { value: 'finished', label: 'Finalizados', Icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelados', Icon: XCircle },
];

const fmtDate = (ymd: string) => {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};
const timeLabel = (e: { allDay: boolean; startTime: string | null; endTime: string | null }) =>
  e.allDay || !e.startTime ? 'Todo el día' : `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}`;

type EventDraft = {
  name: string; description: string; location: string; eventDate: string;
  allDay: boolean; startTime: string; endTime: string;
};
const emptyEvent = (): EventDraft => ({
  name: '', description: '', location: '',
  eventDate: new Date().toISOString().slice(0, 10),
  allDay: false, startTime: '09:00', endTime: '12:00',
});

type TaskDraft = {
  title: string; detail: string; values: string[]; talents: string[];
  plazas: number; ownTime: boolean; startTime: string; endTime: string;
};
const emptyTask = (): TaskDraft => ({
  title: '', detail: '', values: [], talents: [], plazas: 1,
  ownTime: false, startTime: '09:00', endTime: '10:00',
});

/**
 * Sistema "Gestión Social" (controlador · gestión · celda "Soluciones").
 *
 * Pestañas: **Eventos** (funcional), **Recursos** y **Discusión** (reservadas para futuros
 * desarrollos). En Eventos se crean eventos con un conjunto de tareas etiquetadas por
 * valores/talentos y con plazas; el usuario del sistema marca manualmente el INICIO y el FIN
 * del evento, que es lo que desbloquea (y luego congela) el marcado de estado que hacen los
 * participantes desde su "Mi día".
 */
export default function GestionSocialSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [tab, setTab] = useState('eventos');

  return (
    <div>
      <div className="mb-4">
        <PixelTabs
          tabs={[{ value: 'eventos', label: 'Eventos' }, { value: 'recursos', label: 'Recursos' }, { value: 'discusion', label: 'Discusión' }]}
          active={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'eventos' ? <EventosTab isAdmin={isAdmin} /> : <ComingSoon name={tab === 'recursos' ? 'Recursos' : 'Discusión'} />}
    </div>
  );
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl text-center py-16">
      <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3">
        <Info className="w-6 h-6 text-accent" />
      </div>
      <p className="text-base text-digi-text font-semibold mb-1" style={df}>{name}</p>
      <p className="text-[12px] text-digi-muted" style={mf}>Esta funcionalidad estará disponible próximamente.</p>
    </div>
  );
}

/* ── Pestaña EVENTOS ─────────────────────────────────────────────────────────── */

function EventosTab({ isAdmin }: { isAdmin?: boolean }) {
  const [filter, setFilter] = useState('all');
  const [events, setEvents] = useState<SocialEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SocialEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [eventDraft, setEventDraft] = useState<{ id: number | null; d: EventDraft } | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ id: number | null; d: TaskDraft } | null>(null);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter === 'all' ? '' : `?status=${filter}`;
      const res = await fetch(`${API}/eventos${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEvents(j.data.events || []);
      setCounts(j.data.counts || {});
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [filter]);

  const loadDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API}/eventos/${id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDetail(j.data);
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selectedId != null) loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  const refresh = async () => { await load(); if (selectedId != null) await loadDetail(selectedId); };

  // Acción genérica con manejo de error de negocio (409) visible para el usuario.
  const act = async (fn: () => Promise<Response>) => {
    setBusy(true);
    try {
      const res = await fn();
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo completar la acción.');
      setErr(null);
      await refresh();
      return true;
    } catch (e: any) { setErr(e.message); return false; } finally { setBusy(false); }
  };

  const railItems = useMemo(
    () => FILTERS.map((f) => ({ ...f, count: f.value === 'all' ? counts.all : counts[f.value] })),
    [counts],
  );

  const saveEvent = async () => {
    if (!eventDraft) return;
    const { id, d } = eventDraft;
    if (!d.name.trim()) { setErr('El nombre es obligatorio.'); return; }
    const body = {
      name: d.name, description: d.description, location: d.location, eventDate: d.eventDate,
      allDay: d.allDay, startTime: d.allDay ? null : d.startTime, endTime: d.allDay ? null : d.endTime,
    };
    const ok = await act(() => fetch(id ? `${API}/eventos/${id}` : `${API}/eventos`, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    if (ok) setEventDraft(null);
  };

  const saveTask = async () => {
    if (!taskDraft || !detail) return;
    const { id, d } = taskDraft;
    if (!d.title.trim()) { setErr('El título de la tarea es obligatorio.'); return; }
    const body = {
      title: d.title, detail: d.detail, values: d.values, talents: d.talents, plazas: d.plazas,
      startTime: d.ownTime ? d.startTime : null, endTime: d.ownTime ? d.endTime : null,
    };
    const ok = await act(() => fetch(id ? `${API}/tareas/${id}` : `${API}/eventos/${detail.id}/tareas`, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
    if (ok) setTaskDraft(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <FilterRail title="Estado" items={railItems} value={filter} onChange={setFilter} />

      {/* Centro: command bar + lista de eventos */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[13px] font-semibold text-digi-text" style={df}>
            Eventos {loading ? '' : `(${events.length})`}
          </p>
          <button className={`${BTN_PRIMARY} ml-auto`} onClick={() => setEventDraft({ id: null, d: emptyEvent() })} style={mf}>
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        </div>

        {err && (
          <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
            <XCircle className="w-4 h-4 shrink-0" /> {err}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
        ) : events.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
            <PartyPopper className="w-8 h-8 text-digi-muted mx-auto mb-2" />
            <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin eventos</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Crea el primero para que los miembros puedan participar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}
                className={`w-full text-left bg-digi-card border rounded-lg p-3 transition-colors ${selectedId === e.id ? 'border-accent' : 'border-digi-border hover:border-accent/60'}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-digi-text" style={mf}>{e.name}</span>
                  <StatusBadge status={e.status} />
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11.5px] text-digi-muted" style={mf}>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {fmtDate(e.eventDate)}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {timeLabel(e)}</span>
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {e.location}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {e.plazasTaken}/{e.plazasTotal} plazas · {e.taskCount} tarea(s)</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Panel derecho: detalle del evento */}
      <div className="w-full lg:w-[380px] shrink-0">
        {detail ? (
          <EventDetail
            event={detail}
            busy={busy}
            onEdit={() => setEventDraft({
              id: detail.id,
              d: {
                name: detail.name, description: detail.description, location: detail.location,
                eventDate: detail.eventDate, allDay: detail.allDay,
                startTime: detail.startTime || '09:00', endTime: detail.endTime || '12:00',
              },
            })}
            onPublish={() => act(() => fetch(`${API}/eventos/${detail.id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'published' }),
            }))}
            onStart={() => act(() => fetch(`${API}/eventos/${detail.id}/estado`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'start' }),
            }))}
            onFinish={() => setConfirm({
              text: 'Al finalizar el evento, las tareas que los participantes no marcaron como completadas quedarán automáticamente como NO COMPLETADAS y restarán en su perfil de talentos y valores. ¿Finalizar?',
              onOk: () => act(() => fetch(`${API}/eventos/${detail.id}/estado`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'finish' }),
              })),
            })}
            onDelete={() => setConfirm({
              text: `¿Eliminar el evento "${detail.name}"? Se borrarán sus tareas y las tomas de los participantes.`,
              onOk: async () => { const ok = await act(() => fetch(`${API}/eventos/${detail.id}`, { method: 'DELETE' })); if (ok) setSelectedId(null); },
            })}
            onAddTask={() => setTaskDraft({ id: null, d: emptyTask() })}
            onEditTask={(t) => setTaskDraft({
              id: t.id,
              d: {
                title: t.title, detail: t.detail, values: t.values, talents: t.talents, plazas: t.plazas,
                ownTime: !!t.startTime, startTime: t.startTime || '09:00', endTime: t.endTime || '10:00',
              },
            })}
            onDeleteTask={(t) => setConfirm({
              text: `¿Eliminar la tarea "${t.title}"?${t.taken > 0 ? ` ${t.taken} persona(s) ya la tomaron y perderán su asignación.` : ''}`,
              onOk: () => act(() => fetch(`${API}/tareas/${t.id}`, { method: 'DELETE' })),
            })}
          />
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
            <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un evento para ver su detalle.</p>
          </div>
        )}
      </div>

      {/* Formulario de evento */}
      <PixelModal open={!!eventDraft} onClose={() => setEventDraft(null)} title={eventDraft?.id ? 'Editar evento' : 'Nuevo evento'} size="md" busy={busy}>
        {eventDraft && (
          <div className="space-y-3">
            <Field label="Nombre">
              <PixelInput value={eventDraft.d.name} onChange={(e: any) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, name: e.target.value } })} placeholder="Jornada de voluntariado" />
            </Field>
            <Field label="Descripción">
              <textarea
                value={eventDraft.d.description}
                onChange={(e) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, description: e.target.value } })}
                rows={3}
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
                style={mf}
              />
            </Field>
            <Field label="Lugar">
              <PixelInput value={eventDraft.d.location} onChange={(e: any) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, location: e.target.value } })} placeholder="Parque central" />
            </Field>
            <Field label="Fecha">
              <PixelInput type="date" value={eventDraft.d.eventDate} onChange={(e: any) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, eventDate: e.target.value } })} />
            </Field>
            <label className="flex items-center gap-2 text-[12.5px] text-digi-text" style={mf}>
              <input type="checkbox" checked={eventDraft.d.allDay} onChange={(e) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, allDay: e.target.checked } })} />
              Todo el día
            </label>
            {!eventDraft.d.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hora de inicio">
                  <PixelInput type="time" value={eventDraft.d.startTime} onChange={(e: any) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, startTime: e.target.value } })} />
                </Field>
                <Field label="Hora de fin">
                  <PixelInput type="time" value={eventDraft.d.endTime} onChange={(e: any) => setEventDraft({ ...eventDraft, d: { ...eventDraft.d, endTime: e.target.value } })} />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
              <button className={BTN_SECONDARY} onClick={() => setEventDraft(null)} style={mf}>Cancelar</button>
              <button className={BTN_PRIMARY} onClick={saveEvent} disabled={busy} style={mf}>Guardar</button>
            </div>
          </div>
        )}
      </PixelModal>

      {/* Formulario de tarea del evento (mismas etiquetas que el Horario de Vida) */}
      <PixelModal open={!!taskDraft} onClose={() => setTaskDraft(null)} title={taskDraft?.id ? 'Editar tarea' : 'Nueva tarea del evento'} size="md" busy={busy}>
        {taskDraft && (
          <div className="space-y-3">
            <Field label="Título">
              <PixelInput value={taskDraft.d.title} onChange={(e: any) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, title: e.target.value } })} placeholder="Montaje del escenario" />
            </Field>
            <Field label="Detalle">
              <textarea
                value={taskDraft.d.detail}
                onChange={(e) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, detail: e.target.value } })}
                rows={2}
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
                style={mf}
              />
            </Field>
            <Field label="Plazas" hint="Cuántas personas pueden tomar esta tarea">
              <PixelInput
                type="number" min={1}
                value={String(taskDraft.d.plazas)}
                onChange={(e: any) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, plazas: Math.max(1, Number(e.target.value) || 1) } })}
              />
            </Field>
            <Field label="Valores" hint="Suman al completar la tarea; restan si no se completa">
              <MultiSelectSearch
                options={VALOR_OPTIONS}
                selected={taskDraft.d.values}
                onChange={(values) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, values } })}
                placeholder="Buscar valor…"
              />
            </Field>
            <Field label="Talentos">
              <MultiSelectSearch
                options={TALENTO_OPTIONS}
                selected={taskDraft.d.talents}
                onChange={(talents) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, talents } })}
                placeholder="Buscar talento…"
              />
            </Field>
            <label className="flex items-center gap-2 text-[12.5px] text-digi-text" style={mf}>
              <input type="checkbox" checked={taskDraft.d.ownTime} onChange={(e) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, ownTime: e.target.checked } })} />
              Horario propio (si no, hereda el del evento)
            </label>
            {taskDraft.d.ownTime && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio">
                  <PixelInput type="time" value={taskDraft.d.startTime} onChange={(e: any) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, startTime: e.target.value } })} />
                </Field>
                <Field label="Fin">
                  <PixelInput type="time" value={taskDraft.d.endTime} onChange={(e: any) => setTaskDraft({ ...taskDraft, d: { ...taskDraft.d, endTime: e.target.value } })} />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
              <button className={BTN_SECONDARY} onClick={() => setTaskDraft(null)} style={mf}>Cancelar</button>
              <button className={BTN_PRIMARY} onClick={saveTask} disabled={busy} style={mf}>Guardar</button>
            </div>
          </div>
        )}
      </PixelModal>

      <PixelConfirm
        open={!!confirm}
        message={confirm?.text || ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }}
      />
    </div>
  );
}

/* ── Detalle del evento ──────────────────────────────────────────────────────── */

function EventDetail({
  event, busy, onEdit, onPublish, onStart, onFinish, onDelete, onAddTask, onEditTask, onDeleteTask,
}: {
  event: SocialEvent; busy: boolean;
  onEdit: () => void; onPublish: () => void; onStart: () => void; onFinish: () => void; onDelete: () => void;
  onAddTask: () => void; onEditTask: (t: EventTask) => void; onDeleteTask: (t: EventTask) => void;
}) {
  const editable = event.status === 'draft' || event.status === 'published';
  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-3 lg:sticky lg:top-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-digi-text truncate" style={df}>{event.name}</p>
          <div className="mt-1"><StatusBadge status={event.status} /></div>
        </div>
      </div>

      {event.description && <p className="text-[12px] text-digi-muted mt-2 whitespace-pre-wrap" style={mf}>{event.description}</p>}

      <dl className="mt-3 space-y-1.5 text-[12px]" style={mf}>
        <Meta Icon={CalendarDays} label="Fecha" value={fmtDate(event.eventDate)} />
        <Meta Icon={Clock} label="Horario" value={timeLabel(event)} />
        {event.location && <Meta Icon={MapPin} label="Lugar" value={event.location} />}
        <Meta Icon={Users} label="Plazas" value={`${event.plazasTaken} de ${event.plazasTotal} tomadas`} />
      </dl>

      {/* Control del ciclo de vida: publicar → iniciar → finalizar (todo manual). */}
      <div className="mt-3 pt-3 border-t border-digi-border flex flex-wrap gap-2">
        {event.status === 'draft' && (
          <button className={BTN_PRIMARY} onClick={onPublish} disabled={busy || event.taskCount === 0} style={mf}>
            <Megaphone className="w-4 h-4" /> Publicar
          </button>
        )}
        {event.status === 'published' && (
          <button className={BTN_PRIMARY} onClick={onStart} disabled={busy} style={mf}>
            <PlayCircle className="w-4 h-4" /> Iniciar evento
          </button>
        )}
        {event.status === 'active' && (
          <button className={BTN_PRIMARY} onClick={onFinish} disabled={busy} style={mf}>
            <Square className="w-4 h-4" /> Finalizar evento
          </button>
        )}
        {editable && <button className={BTN_SECONDARY} onClick={onEdit} disabled={busy} style={mf}><Pencil className="w-4 h-4" /> Editar</button>}
        <button className={BTN_DANGER} onClick={onDelete} disabled={busy} style={mf}><Trash2 className="w-4 h-4" /> Eliminar</button>
      </div>

      {event.status === 'draft' && event.taskCount === 0 && (
        <p className="mt-2 text-[11.5px] text-digi-muted" style={mf}>Agrega al menos una tarea para poder publicar el evento.</p>
      )}
      {event.status === 'published' && (
        <p className="mt-2 text-[11.5px] text-digi-muted" style={mf}>
          Las tareas ya están en el «Mi día» de quienes las tomaron, pero bloqueadas: se desbloquean al iniciar el evento.
        </p>
      )}

      {/* Tareas del evento */}
      <div className="mt-4 pt-3 border-t border-digi-border">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Tareas</p>
          {editable && (
            <button
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-digi-muted border border-dashed border-digi-border rounded px-2 py-1 hover:border-accent hover:text-accent transition-colors"
              onClick={onAddTask} style={mf}
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          )}
        </div>
        {(event.tasks || []).length === 0 ? (
          <p className="text-[11.5px] text-digi-muted/60 py-2" style={mf}>Sin tareas todavía.</p>
        ) : (
          <div className="space-y-2">
            {(event.tasks || []).map((t) => (
              <TaskRow key={t.id} task={t} editable={editable} onEdit={() => onEditTask(t)} onDelete={() => onDeleteTask(t)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, editable, onEdit, onDelete }: { task: EventTask; editable: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg border border-digi-border bg-digi-darker/40 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium text-digi-text truncate" style={mf}>{task.title}</p>
          {task.detail && <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{task.detail}</p>}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0 ${task.free === 0 ? 'bg-red-500/15 text-red-600' : 'bg-black/[0.05] text-digi-muted'}`} style={mf}>
          {task.taken}/{task.plazas}
        </span>
        {editable && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="text-digi-muted hover:text-accent" aria-label="Editar tarea"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="text-digi-muted hover:text-red-500" aria-label="Eliminar tarea"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>

      {(task.values.length > 0 || task.talents.length > 0 || task.startTime) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {task.startTime && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/[0.05] border border-digi-border text-[10.5px] text-digi-muted" style={mf}>
              <Clock className="w-3 h-3" /> {task.startTime}{task.endTime ? `–${task.endTime}` : ''}
            </span>
          )}
          {task.values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10.5px] text-violet-500" style={mf}>
              <Gem className="w-3 h-3" /> {VALOR_LABEL[v] || v}
            </span>
          ))}
          {task.talents.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10.5px] text-sky-600" style={mf}>
              <Sparkles className="w-3 h-3" /> {t}
            </span>
          ))}
        </div>
      )}

      {(task.signups || []).length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(task.signups || []).map((s) => (
            <span
              key={s.id}
              className={`text-[10.5px] px-1.5 py-0.5 rounded-full border ${
                s.status === 'completed' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-600'
                  : s.status === 'failed' ? 'bg-red-500/15 border-red-400/40 text-red-600'
                    : 'bg-black/[0.05] border-digi-border text-digi-muted'
              }`}
              style={mf}
            >
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Piezas menores ──────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: EventStatus }) {
  const m = STATUS_META[status];
  return <span className={`inline-block text-[10.5px] px-2 py-0.5 rounded-full border ${m.cls}`} style={mf}>{m.label}</span>;
}

function Meta({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-digi-muted shrink-0" />
      <dt className="text-digi-muted">{label}:</dt>
      <dd className="text-digi-text truncate">{value}</dd>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={df}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-digi-muted/70" style={mf}>{hint}</p>}
    </div>
  );
}
