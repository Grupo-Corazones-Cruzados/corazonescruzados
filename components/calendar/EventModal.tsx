'use client';

import { useEffect, useState } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import type { CalendarEvent, RecurrenceType } from '@/lib/calendar/recurrence';
import { DAY_LABELS_ES_SHORT } from '@/lib/calendar/recurrence';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

export interface ClientOption { id: string; name: string; }

export interface EventFormPayload {
  title: string;
  description: string | null;
  event_type: 'work' | 'personal';
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
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (payload: EventFormPayload, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  event: CalendarEvent | null;
  initialDate: Date | null;
  clients: ClientOption[];
}

function toLocalInput(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultPayload(base: Date | null): EventFormPayload {
  const start = base ? new Date(base) : new Date();
  start.setMinutes(0, 0, 0);
  if (!base) start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  return {
    title: '',
    description: '',
    event_type: 'work',
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
  };
}

export default function EventModal({ open, onClose, onSave, onDelete, event, initialDate, clients }: Props) {
  const [form, setForm] = useState<EventFormPayload>(() => defaultPayload(initialDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
    } else {
      setForm(defaultPayload(initialDate));
    }
    setError(null);
  }, [open, event, initialDate]);

  const update = <K extends keyof EventFormPayload>(k: K, v: EventFormPayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
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

  const submit = async () => {
    setError(null);
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    if (form.event_type === 'work' && !form.client_id) { setError('Selecciona un cliente'); return; }
    if (new Date(form.end_at).getTime() < new Date(form.start_at).getTime()) {
      setError('La fecha fin no puede ser anterior al inicio');
      return;
    }
    if (form.recurrence_type === 'weekly' && (!form.recurrence_days || form.recurrence_days.length === 0)) {
      setError('Selecciona al menos un día de la semana');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, description: form.description?.trim() || null }, event?.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;
    if (!confirm('¿Eliminar este evento?')) return;
    setSaving(true);
    try {
      await onDelete(event.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <PixelModal
      open={open}
      onClose={onClose}
      title={event ? 'Editar evento' : 'Nuevo evento'}
      size="lg"
    >
      <div className="space-y-4">
        <PixelInput
          label="TÍTULO"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="Reunión con cliente, clase de yoga…"
        />

        <div>
          <div className="text-[10px] text-accent-glow opacity-70 mb-1" style={pf}>TIPO</div>
          <div className="flex gap-2">
            {(['work', 'personal'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update('event_type', t)}
                className={`flex-1 px-3 py-2 text-[10px] border-2 transition-colors ${
                  form.event_type === t
                    ? 'border-accent bg-accent/10 text-accent-glow'
                    : 'border-digi-border text-digi-muted hover:text-digi-text'
                }`}
                style={pf}
              >
                {t === 'work' ? 'LABORAL' : 'PERSONAL'}
              </button>
            ))}
          </div>
        </div>

        {form.event_type === 'work' && (
          <PixelSelect
            label="CLIENTE"
            value={form.client_id || ''}
            onChange={(e) => update('client_id', e.target.value || null)}
            placeholder="Selecciona un cliente"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}

        <div>
          <label className="text-[10px] text-accent-glow opacity-70" style={pf}>DESCRIPCIÓN (OPCIONAL)</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 mt-1 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
            style={mf}
          />
        </div>

        <label className="flex items-center gap-2 text-[10px] text-digi-text cursor-pointer" style={pf}>
          <input
            type="checkbox"
            checked={form.all_day}
            onChange={(e) => update('all_day', e.target.checked)}
            className="accent-accent"
          />
          TODO EL DÍA
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

        <div>
          <PixelSelect
            label="RECURRENCIA"
            value={form.recurrence_type}
            onChange={(e) => update('recurrence_type', e.target.value as RecurrenceType)}
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
            <div className="text-[10px] text-accent-glow opacity-70 mb-1" style={pf}>DÍAS DE LA SEMANA</div>
            <div className="flex gap-1 flex-wrap">
              {DAY_LABELS_ES_SHORT.map((label, dow) => {
                const active = (form.recurrence_days || []).includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    className={`w-10 h-10 text-[10px] border-2 transition-colors ${
                      active
                        ? 'border-accent bg-accent/20 text-accent-glow'
                        : 'border-digi-border text-digi-muted hover:text-digi-text'
                    }`}
                    style={pf}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.recurrence_type !== 'none' && (
          <div className="grid grid-cols-2 gap-3">
            <PixelInput
              type="number"
              min={1}
              max={30}
              label="REPETIR CADA"
              value={form.recurrence_interval}
              onChange={(e) => update('recurrence_interval', Math.max(1, parseInt(e.target.value) || 1))}
            />
            <PixelInput
              type="date"
              label="HASTA (OPCIONAL)"
              value={form.recurrence_until || ''}
              onChange={(e) => update('recurrence_until', e.target.value || null)}
            />
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-400 border border-red-500/40 bg-red-950/30 px-3 py-2" style={pf}>
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-digi-border">
          <div>
            {event && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-2 text-[10px] border-2 border-red-500/50 text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                style={pf}
              >
                ELIMINAR
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 text-[10px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors disabled:opacity-50"
              style={pf}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 text-[10px] border-2 border-accent bg-accent/20 text-accent-glow hover:bg-accent/30 transition-colors disabled:opacity-50"
              style={pf}
            >
              {saving ? 'GUARDANDO…' : 'GUARDAR'}
            </button>
          </div>
        </div>
      </div>
    </PixelModal>
  );
}
