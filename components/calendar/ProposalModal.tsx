'use client';

import { useEffect, useMemo, useState } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import Segmentado from '@/components/ui/Segmentado';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Send, X, AlertTriangle, Crosshair } from 'lucide-react';
import { DAY_LABELS_ES_SHORT } from '@/lib/calendar/recurrence';

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
  guest_name: string | null;
  guest_email: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ProposalPayload) => Promise<void>;
  memberName: string;
  /** Fecha/hora inicial (al abrir desde un clic en la grilla del calendario). */
  initialStart?: Date | null;
  /** Devuelve true si el rango [startMs,endMs) choca con un espacio ocupado. */
  isBusy?: (startMs: number, endMs: number) => boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

const MEMBER_TZ = 'America/Guayaquil';

const TZ_FALLBACK = [
  MEMBER_TZ, 'America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/New_York',
  'America/Los_Angeles', 'America/Chicago', 'America/Argentina/Buenos_Aires', 'America/Santiago',
  'Europe/Madrid', 'Europe/London', 'UTC',
];

/** Offset actual de una zona, p. ej. "GMT-5". */
function tzOffsetLabel(zone: string): string {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    return p.find((x) => x.type === 'timeZoneName')?.value || '';
  } catch { return ''; }
}

/** Todas las zonas horarias IANA (con su offset), o una lista corta si el navegador no las expone. */
function buildTzOptions(): { value: string; label: string }[] {
  let zones: string[] = [];
  try { zones = ((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone')) || []; } catch { /* noop */ }
  if (!zones.length) zones = TZ_FALLBACK;
  return zones.map((z) => {
    const off = tzOffsetLabel(z);
    return { value: z, label: off ? `${z.replace(/_/g, ' ')} (${off})` : z.replace(/_/g, ' ') };
  });
}

function detectTz(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || MEMBER_TZ; } catch { return MEMBER_TZ; }
}

// Convierte una hora de pared en la zona `tz` a UTC, de forma INDEPENDIENTE de la zona
// horaria del navegador (usa Intl.formatToParts, no `new Date(string)`).
function zonedWallclockToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return new Date(NaN);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  const tzOffset = asUTC - guess; // offset de `tz` en ese instante
  return new Date(guess - tzOffset);
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

export default function ProposalModal({ open, onClose, onSubmit, memberName, initialStart, isBusy }: Props) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(() => todayInTz(MEMBER_TZ));
  const [startTime, setStartTime] = useState<string>('10:00');
  const [endTime, setEndTime] = useState<string>('11:00');
  const [tz, setTz] = useState<string>(() => detectTz());
  const tzList = useMemo(() => buildTzOptions(), []);
  const [recurrence, setRecurrence] = useState<ProposalRecurrence>('none');
  const [days, setDays] = useState<number[]>([]);
  const [until, setUntil] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const detected = detectTz();
    setTz(detected);
    setGuestName('');
    setGuestEmail('');
    setTitle('');
    setDescription('');
    if (initialStart && !Number.isNaN(initialStart.getTime())) {
      // Prellenado desde un clic en la grilla (hora local del visitante).
      const s = initialStart;
      setDate(`${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}`);
      setStartTime(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
      const e2 = new Date(s.getTime() + 60 * 60 * 1000);
      setEndTime(`${pad2(e2.getHours())}:${pad2(e2.getMinutes())}`);
    } else {
      setDate(todayInTz(MEMBER_TZ));
      setStartTime('10:00');
      setEndTime('11:00');
    }
    setRecurrence('none');
    setDays([]);
    setUntil('');
    setError(null);
  }, [open, initialStart]);

  // La FECHA/INICIO/FIN se interpretan SIEMPRE en horario del miembro (Ecuador GMT-5).
  // La zona del visitante solo se usa para mostrarle la equivalencia ("Tu horario").
  const startUTC = useMemo(() => zonedWallclockToUTC(date, startTime, MEMBER_TZ), [date, startTime]);
  const endUTC = useMemo(() => zonedWallclockToUTC(date, endTime, MEMBER_TZ), [date, endTime]);

  // Choque con un espacio ocupado del calendario del miembro (aviso en vivo + bloqueo).
  const slotBusy = useMemo(() => {
    if (!isBusy) return false;
    const s = startUTC.getTime(), e = endUTC.getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return false;
    return isBusy(s, e);
  }, [isBusy, startUTC, endUTC]);

  const autoDetectTz = () => setTz(detectTz());

  const toggleDay = (dow: number) => {
    setDays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()));
  };

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(guestEmail.trim())) { setError('Ingresa un correo electrónico válido'); return; }
    if (!title.trim()) { setError('El título es requerido'); return; }
    if (endUTC.getTime() <= startUTC.getTime()) { setError('La hora fin debe ser posterior al inicio'); return; }
    if (startUTC.getTime() < Date.now() - 60_000) { setError('No puedes proponer horarios en el pasado'); return; }
    if (slotBusy) { setError('Ese horario ya está ocupado. Elige otro.'); return; }
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
      guest_name: guestName.trim() || null,
      guest_email: guestEmail.trim().toLowerCase(),
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

  // La equivalencia en la hora del visitante solo se dice si ES DISTINTA: con la misma zona
  // repetía las dos fechas que ya se ven en los campos.
  const tuHorario = formatInTz(startUTC, tz) !== formatInTz(startUTC, MEMBER_TZ)
    ? `${formatInTz(startUTC, tz)} – ${new Intl.DateTimeFormat('es-EC', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(endUTC)}`
    : null;

  /*
   * ⭐ EL FORMULARIO, TAMBIÉN PARA EL TELÉFONO (Fernando, 2026-10-31: «este formulario es de
   * computadora»). En el iPhone los campos de fecha y hora se salían por la derecha (el control
   * nativo tiene ancho mínimo propio), había un párrafo de explicación arriba, dos cajas
   * rellenas que repetían la fecha y los botones al final de todo. Ahora:
   *  · grupos con su nombre (Tus datos · La reunión · Cuándo), sin párrafo de ayuda;
   *  · la fecha a todo el ancho e Inicio/Fin en dos columnas (que quepan en iOS: `globals.css`);
   *  · la zona horaria con su botón de detectar como icono al lado;
   *  · «en tu hora» en UNA línea y solo si tu zona es otra; avisos como texto, sin caja;
   *  · los botones en el pie del panel (en el teléfono, a partes iguales y siempre a la vista).
   */
  const grupo = 'text-[11px] font-semibold uppercase tracking-wider text-digi-muted';

  return (
    <PixelModal
      open={open}
      onClose={onClose}
      title="Proponer espacio"
      size="lg"
      busy={saving}
      pie={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={BTN_SECONDARY} style={mf}>
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving || slotBusy} className={BTN_PRIMARY} style={mf}>
            <Send className="w-4 h-4" /> {saving ? 'Enviando…' : slotBusy ? 'Horario ocupado' : 'Enviar propuesta'}
          </button>
        </>
      }
    >
      <div className="space-y-6" style={mf}>
        <section className="space-y-3">
          <h3 className={grupo}>Tus datos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PixelInput label="TU NOMBRE" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" />
            <PixelInput type="email" label="TU CORREO" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" inputMode="email" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={grupo}>La reunión con {memberName.split(" ")[0]}</h3>
          <PixelInput label="TÍTULO" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunión inicial, sesión de revisión…" />
          <div className="flex flex-col gap-1">
            <label htmlFor="propuesta-detalle" className="field-label text-[10px] text-accent-glow opacity-70" style={{ fontFamily: 'var(--font-display)' }}>DETALLE (OPCIONAL)</label>
            <textarea
              id="propuesta-detalle"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:outline-none"
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className={grupo}>Cuándo · hora de Ecuador (GMT-5)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 md:col-span-1 min-w-0">
              <PixelInput type="date" label="FECHA" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="min-w-0">
              <PixelInput type="time" label="INICIO" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="min-w-0">
              <PixelInput type="time" label="FIN" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          {slotBusy && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-amber-600">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Ese horario ya está ocupado. Elige otra fecha u hora.
            </p>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <SearchableSelect label="TU ZONA HORARIA" value={tz} onChange={setTz} options={tzList} searchPlaceholder="Buscar zona horaria…" />
            </div>
            <button
              type="button"
              onClick={autoDetectTz}
              className={`${BTN_SECONDARY} !w-11 !h-11 !px-0 shrink-0`}
              title="Detectar mi zona horaria"
              aria-label="Detectar mi zona horaria"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>
          {tuHorario && (
            <p className="text-[12.5px] text-digi-muted">
              En tu hora: <span className="text-digi-text">{tuHorario}</span>
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className={grupo}>Se repite</h3>
          <Segmentado
            etiqueta="Recurrencia"
            className="w-full md:max-w-sm"
            valor={recurrence}
            onChange={setRecurrence}
            opciones={[
              { valor: 'none', texto: 'Un solo día' },
              { valor: 'weekly', texto: 'Cada semana' },
            ]}
          />
          {recurrence === 'weekly' && (
            <>
              <div role="group" aria-label="Días de la semana" className="grid grid-cols-7 gap-1 md:flex">
                {DAY_LABELS_ES_SHORT.map((label, dow) => {
                  const active = days.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      onClick={() => toggleDay(dow)}
                      aria-pressed={active}
                      className={`h-11 md:w-10 md:h-10 text-[12px] border rounded-md transition-colors ${
                        active ? 'border-accent text-accent font-semibold' : 'border-digi-border text-digi-muted hover:text-digi-text'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="min-w-0 md:max-w-[220px]">
                <PixelInput type="date" label="HASTA (OPCIONAL)" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            </>
          )}
        </section>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] text-red-500">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
      </div>
    </PixelModal>
  );
}
