'use client';

import { useEffect, useState } from 'react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import { Save, Trash2, X, AlertTriangle, Video, Copy, Check } from 'lucide-react';
import type { CalendarEvent, RecurrenceType, EventType } from '@/lib/calendar/recurrence';
import { DAY_LABELS_ES_SHORT, EVENT_TYPE_LABELS_ES } from '@/lib/calendar/recurrence';

const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

export interface ClientOption { id: string; name: string; }

export interface EventFormPayload {
  title: string;
  description: string | null;
  event_type: EventType;
  client_id: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[] | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  color: string | null;
  alternative_id: number | null;
}

export interface TaskOption { id: number; title: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: EventFormPayload, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  event: CalendarEvent | null;
  initialDate: Date | null;
  initialType?: EventType;
  clients: ClientOption[];
  tasks?: TaskOption[];        // tareas del Horario de Vida (para justificar el tiempo)
  initialTaskId?: number | null;
}

function toLocalInput(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTimeStr(t: string): [number, number] {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

function isoFrom(y: number, mo: number, d: number, hh: number, mm: number): string {
  return new Date(y, mo, d, hh, mm, 0, 0).toISOString();
}

function toLocalDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultPayload(base: Date | null, type: EventType = 'progreso'): EventFormPayload {
  const start = base ? new Date(base) : new Date();
  start.setMinutes(0, 0, 0);
  if (!base) start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return {
    title: '',
    description: '',
    event_type: type,
    client_id: null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: false,
    timezone: 'America/Guayaquil',
    recurrence_type: 'none',
    recurrence_days: null,
    recurrence_interval: 1,
    recurrence_until: null,
    color: null,
    alternative_id: null,
  };
}

export default function EventModal({ open, onClose, onSave, onDelete, event, initialDate, initialType, clients, tasks = [], initialTaskId = null }: Props) {
  const [form, setForm] = useState<EventFormPayload>(() => defaultPayload(initialDate, initialType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 'forever' = se repite sin fecha fin; 'date' = termina en recurrence_until.
  const [untilMode, setUntilMode] = useState<'forever' | 'date'>('forever');

  useEffect(() => {
    if (!open) return;
    if (event) {
      setForm({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        client_id: event.client_id,
        start_at: event.start_at,
        end_at: event.end_at,
        all_day: event.all_day,
        timezone: event.timezone || 'America/Guayaquil',
        recurrence_type: event.recurrence_type,
        recurrence_days: event.recurrence_days,
        recurrence_interval: event.recurrence_interval || 1,
        recurrence_until: event.recurrence_until,
        color: event.color,
        alternative_id: event.alternative_id ?? null,
      });
    } else {
      const base = defaultPayload(initialDate, initialType);
      if (initialTaskId != null) {
        base.alternative_id = initialTaskId;
        const tk = tasks.find((t) => t.id === initialTaskId);
        if (tk && !base.title) base.title = tk.title;
      }
      setForm(base);
    }
    setUntilMode(event?.recurrence_until ? 'date' : 'forever');
    setConfirmDelete(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, initialDate, initialType, initialTaskId]);

  const update = <K extends keyof EventFormPayload>(k: K, v: EventFormPayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const setEventType = (t: EventType) => {
    setForm((f) => ({
      ...f,
      event_type: t,
      client_id: t === 'progreso' ? f.client_id : null,
    }));
  };

  const setStart = (local: string) => {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return;
    const diff = new Date(form.end_at).getTime() - new Date(form.start_at).getTime();
    const newEnd = new Date(d.getTime() + (diff > 0 ? diff : 60 * 60 * 1000));
    update('start_at', d.toISOString());
    update('end_at', newEnd.toISOString());
  };

  const setEnd = (local: string) => {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return;
    update('end_at', d.toISOString());
  };

  const toggleDay = (dow: number) => {
    const cur = form.recurrence_days || [];
    const next = cur.includes(dow) ? cur.filter((d) => d !== dow) : [...cur, dow].sort();
    update('recurrence_days', next);
  };

  // Para eventos recurrentes: inicio y fin viven en el mismo día.
  // La fecha sólo define cuándo empieza la serie / qué día del mes.
  const setRecurringDate = (dateStr: string) => {
    const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
    if (!y || !mo || !d) return;
    setForm((f) => {
      const s = new Date(f.start_at);
      const e = new Date(f.end_at);
      return {
        ...f,
        start_at: isoFrom(y, mo - 1, d, s.getHours(), s.getMinutes()),
        end_at: isoFrom(y, mo - 1, d, e.getHours(), e.getMinutes()),
      };
    });
  };

  const setMonthDay = (day: number) => {
    const d = Math.min(31, Math.max(1, day || 1));
    setForm((f) => {
      const s = new Date(f.start_at);
      const e = new Date(f.end_at);
      return {
        ...f,
        start_at: isoFrom(s.getFullYear(), s.getMonth(), d, s.getHours(), s.getMinutes()),
        end_at: isoFrom(s.getFullYear(), s.getMonth(), d, e.getHours(), e.getMinutes()),
      };
    });
  };

  const setStartTime = (t: string) => {
    const [hh, mm] = parseTimeStr(t);
    setForm((f) => {
      const s = new Date(f.start_at);
      return { ...f, start_at: isoFrom(s.getFullYear(), s.getMonth(), s.getDate(), hh, mm) };
    });
  };

  const setEndTime = (t: string) => {
    const [hh, mm] = parseTimeStr(t);
    setForm((f) => {
      const s = new Date(f.start_at); // mismo día que el inicio
      return { ...f, end_at: isoFrom(s.getFullYear(), s.getMonth(), s.getDate(), hh, mm) };
    });
  };

  const setRecurrence = (type: RecurrenceType) => {
    setForm((f) => {
      if (type === 'none') return { ...f, recurrence_type: type };
      const s = new Date(f.start_at);
      const e = new Date(f.end_at);
      const start = isoFrom(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes());
      let end = isoFrom(s.getFullYear(), s.getMonth(), s.getDate(), e.getHours(), e.getMinutes());
      if (new Date(end).getTime() <= new Date(start).getTime()) {
        end = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
      }
      return { ...f, recurrence_type: type, all_day: false, start_at: start, end_at: end };
    });
  };

  const submit = async () => {
    setError(null);
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    if (new Date(form.end_at).getTime() < new Date(form.start_at).getTime()) {
      setError('La fecha fin no puede ser anterior al inicio');
      return;
    }
    if (form.recurrence_type === 'weekly' && (!form.recurrence_days || form.recurrence_days.length === 0)) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    if (form.recurrence_type !== 'none' && untilMode === 'date' && !form.recurrence_until) {
      setError('Elige la fecha hasta la que se repite, o selecciona "Siempre"');
      return;
    }
    setSaving(true);
    try {
      const recurrence_until = form.recurrence_type === 'none' || untilMode === 'forever'
        ? null
        : form.recurrence_until;
      await onSave(
        { ...form, recurrence_until, description: form.description?.trim() || null },
        event?.id,
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    setConfirmDelete(false);
    setSaving(true);
    try {
      await onDelete(event.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FloatingWindow
      open={open}
      onClose={onClose}
      title={event ? 'Editar evento' : 'Nuevo evento'}
      initialWidth={560}
      initialHeight={640}
    >
      <div className="space-y-4">
        {event?.meeting_url && <MeetingLink url={event.meeting_url} />}

        <PixelInput
          label="TÍTULO"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Reunión con cliente, clase de yoga…"
        />

        <div>
          <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Tipo</div>
          <div className="flex gap-2">
            {(['progreso', 'personal'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                className={`flex-1 px-3 py-2 text-[13px] border rounded-md transition-colors ${
                  form.event_type === t
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-digi-border text-digi-muted hover:text-digi-text'
                }`}
                style={mf}
              >
                {EVENT_TYPE_LABELS_ES[t]}
              </button>
            ))}
          </div>
        </div>

        {form.event_type === 'progreso' && (
          <PixelSelect
            label="CLIENTE (OPCIONAL)"
            value={form.client_id || ''}
            onChange={(e) => update('client_id', e.target.value || null)}
            placeholder="Sin cliente"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}

        {/* Tarea del horario: SOLO se muestra (de solo lectura) al abrir el modal desde
            "Registrar tiempo" del panel de tareas. No se puede elegir ni cambiar en
            formularios nuevos/edición. El vínculo (alternative_id) ya viene en el form. */}
        {!event && initialTaskId != null && form.alternative_id != null && (
          <div>
            <label className="text-[12px] font-medium text-digi-muted" style={mf}>TAREA DEL HORARIO (JUSTIFICA EL TIEMPO)</label>
            <div className="w-full px-2.5 py-1.5 mt-1 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text opacity-80 cursor-not-allowed select-none" style={mf}>
              {tasks.find((t) => t.id === form.alternative_id)?.title || 'Tarea seleccionada'}
            </div>
            <p className="text-[11px] text-digi-muted mt-1" style={mf}>Vinculada desde el panel de tareas; no se puede cambiar.</p>
          </div>
        )}

        <div>
          <label className="text-[12px] font-medium text-digi-muted" style={mf}>Descripción (opcional)</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="field-control w-full px-2.5 py-1.5 mt-1 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
            style={mf}
          />
        </div>

        {form.recurrence_type === 'none' ? (
          <>
            <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer" style={mf}>
              <input
                type="checkbox"
                checked={form.all_day}
                onChange={(e) => update('all_day', e.target.checked)}
                className="accent-accent"
              />
              Todo el día
            </label>

            <div className="grid grid-cols-2 gap-3">
              {form.all_day ? (
                <>
                  <PixelInput
                    type="date"
                    label="FECHA INICIO"
                    value={toLocalDate(form.start_at)}
                    onChange={(e) => setStart(`${e.target.value}T00:00`)}
                  />
                  <PixelInput
                    type="date"
                    label="FECHA FIN"
                    value={toLocalDate(form.end_at)}
                    onChange={(e) => setEnd(`${e.target.value}T23:59`)}
                  />
                </>
              ) : (
                <>
                  <PixelInput
                    type="datetime-local"
                    label="INICIO"
                    value={toLocalInput(form.start_at)}
                    onChange={(e) => setStart(e.target.value)}
                  />
                  <PixelInput
                    type="datetime-local"
                    label="FIN"
                    value={toLocalInput(form.end_at)}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {form.recurrence_type === 'monthly' ? (
              <PixelInput
                type="number"
                min={1}
                max={31}
                label="DÍA DEL MES"
                value={new Date(form.start_at).getDate()}
                onChange={(e) => setMonthDay(parseInt(e.target.value, 10))}
              />
            ) : (
              <PixelInput
                type="date"
                label="FECHA DE INICIO"
                value={toLocalDate(form.start_at)}
                onChange={(e) => setRecurringDate(e.target.value)}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <PixelInput
                type="time"
                label="HORA INICIO"
                value={toLocalTime(form.start_at)}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <PixelInput
                type="time"
                label="HORA FIN"
                value={toLocalTime(form.end_at)}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <PixelSelect
            label="RECURRENCIA"
            value={form.recurrence_type}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
            options={[
              { value: 'none', label: 'No se repite' },
              { value: 'daily', label: 'Diariamente' },
              { value: 'weekly', label: 'Semanalmente' },
              { value: 'monthly', label: 'Mensualmente' },
            ]}
          />
        </div>

        {form.recurrence_type === 'weekly' && (
          <div>
            <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Días de la semana</div>
            <div className="flex gap-1 flex-wrap">
              {DAY_LABELS_ES_SHORT.map((label, dow) => {
                const active = (form.recurrence_days || []).includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    className={`w-10 h-10 text-[12px] border rounded-md transition-colors ${
                      active
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-digi-border text-digi-muted hover:text-digi-text'
                    }`}
                    style={mf}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.recurrence_type !== 'none' && (
          <div className="space-y-3">
            <div>
              <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>¿Hasta cuándo?</div>
              <div className="flex gap-2">
                {([
                  ['forever', 'Siempre'],
                  ['date', 'Hasta una fecha'],
                ] as const).map(([m, lbl]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setUntilMode(m);
                      if (m === 'forever') update('recurrence_until', null);
                    }}
                    className={`flex-1 px-3 py-2 text-[13px] border rounded-md transition-colors ${
                      untilMode === m
                        ? 'border-accent bg-accent-light text-accent'
                        : 'border-digi-border text-digi-muted hover:text-digi-text'
                    }`}
                    style={mf}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {untilMode === 'date' && (
              <PixelInput
                type="date"
                label="FECHA FINAL"
                value={form.recurrence_until || ''}
                onChange={(e) => update('recurrence_until', e.target.value || null)}
              />
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[13px] text-red-600 border border-red-300 bg-red-50 rounded-md px-3 py-2" style={mf}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-digi-border">
          <div>
            {event && onDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className={BTN_DANGER}
                style={mf}
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={BTN_SECONDARY}
              style={mf}
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className={BTN_PRIMARY}
              style={mf}
            >
              <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      <PixelConfirm
        open={confirmDelete}
        title="Eliminar evento"
        message="¿Eliminar este evento? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </FloatingWindow>
  );
}

/** Banner del enlace de la reunión (Google Meet) de un evento agendado. */
function MeetingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };
  return (
    <div className="rounded-lg border border-accent/40 bg-accent-light p-3" style={mf}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-accent mb-2">
        <Video className="w-4 h-4" /> Enlace de la reunión
      </div>
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_PRIMARY} flex-1 !py-1.5 text-[12.5px]`}
        >
          <Video className="w-4 h-4" /> Unirse a Google Meet
        </a>
        <button type="button" onClick={copy} className={`${BTN_SECONDARY} !py-1.5 !px-2.5`} title="Copiar enlace">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block text-[11px] text-accent/80 hover:underline truncate">
        {url}
      </a>
    </div>
  );
}
