'use client';

import { useEffect, useMemo, useState } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Send, X, AlertTriangle, Crosshair } from 'lucide-react';
import { DAY_LABELS_ES_SHORT } from '@/lib/calendar/recurrence';

const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

export type ProposalRecurrence = 'none' | 'weekly';

export interface ProposalPayload {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  recurrence_type: ProposalRecurrence;
  recurrence_days: number[] | null;
  recurrence_interval: number;
  recurrence_until: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ProposalPayload) => Promise<void>;
  memberName: string;
}

const MEMBER_TZ = 'America/Guayaquil';

const TZ_OPTIONS = [
  { value: MEMBER_TZ, label: 'Ecuador (GMT-5)' },
  { value: 'America/Bogota', label: 'Colombia (GMT-5)' },
  { value: 'America/Lima', label: 'Perú (GMT-5)' },
  { value: 'America/Mexico_City', label: 'México (GMT-6)' },
  { value: 'America/New_York', label: 'Nueva York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8/-7)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6/-5)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (GMT-3)' },
  { value: 'America/Santiago', label: 'Chile (GMT-4/-3)' },
  { value: 'Europe/Madrid', label: 'España (GMT+1/+2)' },
  { value: 'Europe/London', label: 'Londres (GMT+0/+1)' },
  { value: 'UTC', label: 'UTC' },
];

function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || MEMBER_TZ; } catch { return MEMBER_TZ; }
}

function zonedWallclockToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return new Date(NaN);
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const asTz = new Date(utcGuess.toLocaleString('en-US', { timeZone: tz }));
  const offset = utcGuess.getTime() - asTz.getTime();
  return new Date(utcGuess.getTime() + offset);
}

function formatInTz(d: Date, tz: string): string {
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: tz,
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

function todayInTz(tz: string): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export default function ProposalModal({ open, onClose, onSubmit, memberName }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(() => todayInTz(detectTz()));
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [tz, setTz] = useState<string>(() => detectTz());
  const [tzList, setTzList] = useState(TZ_OPTIONS);
  const [recurrence, setRecurrence] = useState<ProposalRecurrence>('none');
  const [days, setDays] = useState<number[]>([]);
  const [until, setUntil] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const detected = detectTz();
    setTz(detected);
    setDate(todayInTz(detected));
    setTitle('');
    setDescription('');
    setStartTime('10:00');
    setEndTime('11:00');
    setRecurrence('none');
    setDays([]);
    setUntil('');
    setError(null);
    if (detected && !TZ_OPTIONS.some((o) => o.value === detected)) {
      setTzList([{ value: detected, label: `${detected} (auto)` }, ...TZ_OPTIONS]);
    } else {
      setTzList(TZ_OPTIONS);
    }
  }, [open]);

  const startUTC = useMemo(() => zonedWallclockToUTC(date, startTime, tz), [date, startTime, tz]);
  const endUTC = useMemo(() => zonedWallclockToUTC(date, endTime, tz), [date, endTime, tz]);

  const autoDetectTz = () => {
    const d = detectTz();
    setTz(d);
    if (d && !tzList.some((o) => o.value === d)) {
      setTzList([{ value: d, label: `${d} (auto)` }, ...TZ_OPTIONS]);
    }
  };

  const toggleDay = (dow: number) => {
    setDays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()));
  };

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError('El título es requerido'); return; }
    if (endUTC.getTime() <= startUTC.getTime()) { setError('La hora fin debe ser posterior al inicio'); return; }
    if (startUTC.getTime() < Date.now() - 60_000) { setError('No puedes proponer horarios en el pasado'); return; }
    if (recurrence === 'weekly' && days.length === 0) { setError('Selecciona al menos un día'); return; }

    const payload: ProposalPayload = {
      title: title.trim(),
      description: description.trim() || null,
      start_at: startUTC.toISOString(),
      end_at: endUTC.toISOString(),
      timezone: tz,
      recurrence_type: recurrence,
      recurrence_days: recurrence === 'weekly' ? days : null,
      recurrence_interval: 1,
      recurrence_until: recurrence === 'weekly' && until ? until : null,
    };
    setSaving(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al enviar propuesta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PixelModal open={open} onClose={onClose} title="Proponer espacio" size="lg">
      <div className="space-y-4">
        <p className="text-[13px] text-digi-muted" style={mf}>
          Propón un espacio con <strong>{memberName}</strong>. Tu propuesta se marcará como pendiente
          hasta que {memberName} la acepte o rechace (recibirás un correo con la decisión).
        </p>

        <PixelInput
          label="TÍTULO"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Reunión inicial, sesión de revisión…"
        />

        <div>
          <label className="text-[12px] font-medium text-digi-muted" style={mf}>Detalle (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="field-control w-full mt-1 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none"
            style={mf}
          />
        </div>

        <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 rounded-md px-3 py-2 text-[12px] text-amber-700 leading-relaxed" style={mf}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El calendario de {memberName} se maneja en zona horaria de Ecuador (GMT-5).
            Elige tu zona horaria abajo para ver la equivalencia antes de enviar.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PixelInput
            type="date"
            label="FECHA"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <PixelInput
            type="time"
            label="INICIO"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <PixelInput
            type="time"
            label="FIN"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
          <PixelSelect
            label="TU ZONA HORARIA"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            options={tzList.map((t) => ({ value: t.value, label: t.label }))}
          />
          <button
            type="button"
            onClick={autoDetectTz}
            className={`${BTN_SECONDARY} whitespace-nowrap`}
            style={mf}
          >
            <Crosshair className="w-4 h-4" /> Auto-detectar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
          <div className="rounded-lg border border-digi-border bg-digi-darker p-3 space-y-1" style={mf}>
            <div className="text-digi-muted text-[12px] font-medium">Tu horario ({tz})</div>
            <div className="text-digi-text">Inicio: {formatInTz(startUTC, tz)}</div>
            <div className="text-digi-text">Fin: {formatInTz(endUTC, tz)}</div>
          </div>
          <div className="rounded-lg border border-accent bg-accent-light p-3 space-y-1" style={mf}>
            <div className="text-accent text-[12px] font-medium">Horario del miembro (Ecuador GMT-5)</div>
            <div className="text-digi-text">Inicio: {formatInTz(startUTC, MEMBER_TZ)}</div>
            <div className="text-digi-text">Fin: {formatInTz(endUTC, MEMBER_TZ)}</div>
          </div>
        </div>

        <div>
          <PixelSelect
            label="RECURRENCIA"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as ProposalRecurrence)}
            options={[
              { value: 'none', label: 'Un solo día' },
              { value: 'weekly', label: 'Semanalmente (días seleccionados)' },
            ]}
          />
        </div>

        {recurrence === 'weekly' && (
          <>
            <div>
              <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Días de la semana</div>
              <div className="flex gap-1 flex-wrap">
                {DAY_LABELS_ES_SHORT.map((label, dow) => {
                  const active = days.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => toggleDay(dow)}
                      className={`w-10 h-10 text-[12px] border rounded-md transition-colors ${
                        active ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:text-digi-text'
                      }`}
                      style={mf}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <PixelInput
              type="date"
              label="HASTA (OPCIONAL)"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 text-[13px] text-red-600 border border-red-300 bg-red-50 rounded-md px-3 py-2" style={mf}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
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
            <Send className="w-4 h-4" /> {saving ? 'Enviando…' : 'Enviar propuesta'}
          </button>
        </div>
      </div>
    </PixelModal>
  );
}
