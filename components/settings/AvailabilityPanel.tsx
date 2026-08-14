'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BTN_PRIMARY } from '@/components/ui/Button';
import BotonAyuda from '@/components/ui/BotonAyuda';
import Interruptor from '@/components/ui/Interruptor';
import { fmtNum } from '@/lib/format';
import { CalendarClock, Clock3, CalendarCheck, Save, Briefcase, Loader2, Check } from 'lucide-react';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface DaySchedule { active: boolean; start: string; end: string; }

const defaultSchedule = (): Record<string, DaySchedule> => {
  const s: Record<string, DaySchedule> = {};
  DAY_KEYS.forEach((k, i) => { s[k] = { active: i < 5, start: '09:00', end: '17:00' }; });
  return s;
};

const mf = { fontFamily: 'var(--font-body)' } as const;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const dayHours = (d: DaySchedule) => Math.max(0, toMin(d.end) - toMin(d.start)) / 60;

/* ── Disponibilidad LABORAL (la que lee un reclutador) ───────────────────────
 * No es lo mismo que el horario semanal de abajo, y confundirlas fue el primer
 * malentendido de esta pantalla: el horario dice *a qué hora atiendes*, esto dice
 * *cuándo puedes empezar, con qué jornada y desde dónde*. Vive en
 * `member_cv_profiles` (campos `job_*`) y es lo que sale en el CV público.        */
type EstadoLaboral = 'immediate' | 'from_date' | 'not_available';

const ESTADOS: { v: EstadoLaboral; label: string }[] = [
  { v: 'immediate', label: 'De inmediato' },
  { v: 'from_date', label: 'A partir de una fecha' },
  { v: 'not_available', label: 'No disponible por ahora' },
];
const JORNADAS = [
  { v: 'full', label: 'Jornada completa' },
  { v: 'part', label: 'Media jornada' },
  { v: 'both', label: 'Completa o parcial' },
];
const MODALIDADES = [
  { v: 'remote', label: 'Remoto' },
  { v: 'hybrid', label: 'Híbrido' },
  { v: 'onsite', label: 'Presencial' },
  { v: 'any', label: 'Cualquiera' },
];

interface Laboral {
  job_status: EstadoLaboral;
  job_available_from: string;
  job_workday: string;
  job_mode: string;
  job_note: string;
}
const laboralPorDefecto = (): Laboral => ({
  job_status: 'immediate', job_available_from: '', job_workday: 'full', job_mode: 'any', job_note: '',
});

/** Panel de Disponibilidad: disponibilidad laboral + horario semanal de atención. Autónomo. */
export default function AvailabilityPanel() {
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [laboral, setLaboral] = useState<Laboral>(laboralPorDefecto());
  const [laboralEstado, setLaboralEstado] = useState<'idle' | 'saving' | 'done'>('idle');
  const [laboralSucio, setLaboralSucio] = useState(false);

  useEffect(() => {
    fetch('/api/users/availability')
      .then((r) => r.json())
      .then((data) => { if (data.schedule) setSchedule(data.schedule); })
      .catch(() => {});
    fetch('/api/members/cv/publico')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setLaboral({
          job_status: d.job_status || 'immediate',
          job_available_from: d.job_available_from || '',
          job_workday: d.job_workday || 'full',
          job_mode: d.job_mode || 'any',
          job_note: d.job_note || '',
        });
      })
      .catch(() => {});
  }, []);

  const tocarLaboral = (patch: Partial<Laboral>) => {
    setLaboral((p) => ({ ...p, ...patch }));
    setLaboralSucio(true);
    setLaboralEstado('idle');
  };

  const guardarLaboral = async () => {
    setLaboralEstado('saving');
    try {
      const res = await fetch('/api/members/cv/publico', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...laboral,
          // Una fecha solo tiene sentido con el estado que la usa; si no, se limpia
          // para no dejar en la base un dato que la pantalla ya no enseña.
          job_available_from: laboral.job_status === 'from_date' ? laboral.job_available_from : '',
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      setLaboralEstado('done');
      setLaboralSucio(false);
      setTimeout(() => setLaboralEstado('idle'), 1400);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la disponibilidad laboral');
      setLaboralEstado('idle');
    }
  };

  const update = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setDirty(true);
  };

  const applyPreset = (fn: (i: number) => boolean) => {
    setSchedule((prev) => {
      const next: Record<string, DaySchedule> = {};
      DAY_KEYS.forEach((k, i) => { next[k] = { ...prev[k], active: fn(i) }; });
      return next;
    });
    setDirty(true);
  };

  const { activeCount, totalHours } = useMemo(() => {
    const active = DAY_KEYS.filter((k) => schedule[k].active);
    return { activeCount: active.length, totalHours: active.reduce((s, k) => s + dayHours(schedule[k]), 0) };
  }, [schedule]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/availability', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schedule }),
      });
      if (!res.ok) throw new Error();
      toast.success('Disponibilidad guardada');
      setDirty(false);
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const presetBtn = 'px-2.5 py-1 rounded-md text-[12px] font-medium border border-digi-border text-digi-text hover:border-accent hover:text-accent transition-colors';

  const segmento = (activo: boolean) =>
    `px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors ${
      activo ? 'bg-accent-light border-accent text-accent' : 'border-digi-border text-digi-muted hover:border-accent/40 hover:text-digi-text'
    }`;

  return (
    <div className="space-y-4">
      {/* ── Disponibilidad LABORAL (lo que ve un reclutador en el CV público) ── */}
      <div className="rounded-xl border border-digi-border overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-digi-text" style={mf}>
            <Briefcase className="w-4 h-4 text-accent" /> Disponibilidad laboral
          </span>
          <BotonAyuda titulo="Disponibilidad laboral">
            <p>
              Es lo que aparece en tu <strong>CV público</strong> y lo primero que mira quien
              selecciona personal: cuándo puedes empezar, qué jornada aceptas y si trabajas
              en remoto.
            </p>
            <p className="mt-2">
              No es lo mismo que el <strong>horario semanal</strong> de abajo, que es tu franja
              de atención dentro del grupo.
            </p>
          </BotonAyuda>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Cuándo puedes empezar</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {ESTADOS.map((e) => (
                <button key={e.v} type="button" onClick={() => tocarLaboral({ job_status: e.v })}
                  className={segmento(laboral.job_status === e.v)} style={mf}>{e.label}</button>
              ))}
              {/* El campo de fecha aparece SOLO con el estado que lo usa: un selector
                  de fecha atenuado al lado de «de inmediato» es ruido permanente. */}
              {laboral.job_status === 'from_date' && (
                <input type="date" value={laboral.job_available_from}
                  onChange={(e) => tocarLaboral({ job_available_from: e.target.value })}
                  className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-digi-text" style={mf}>Jornada</label>
              <div className="flex flex-wrap gap-1.5">
                {JORNADAS.map((j) => (
                  <button key={j.v} type="button" onClick={() => tocarLaboral({ job_workday: j.v })}
                    className={segmento(laboral.job_workday === j.v)} style={mf}>{j.label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-digi-text" style={mf}>Modalidad</label>
              <div className="flex flex-wrap gap-1.5">
                {MODALIDADES.map((m) => (
                  <button key={m.v} type="button" onClick={() => tocarLaboral({ job_mode: m.v })}
                    className={segmento(laboral.job_mode === m.v)} style={mf}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Nota</label>
            <input value={laboral.job_note} onChange={(e) => tocarLaboral({ job_note: e.target.value })}
              maxLength={400} placeholder="Ej. Con disponibilidad para viajar dentro del país"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          </div>

          <div className="flex justify-end">
            <button onClick={guardarLaboral} disabled={laboralEstado === 'saving' || (!laboralSucio && laboralEstado !== 'done')}
              className={`${BTN_PRIMARY} min-w-[9rem] ${laboralEstado === 'done' ? '!bg-emerald-600 hover:!bg-emerald-600 !opacity-100' : ''}`} aria-live="polite">
              {laboralEstado === 'saving' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>)
                : laboralEstado === 'done' ? (<><Check className="w-4 h-4" /> ¡Guardado!</>)
                : (<><Save className="w-4 h-4" /> Guardar disponibilidad</>)}
            </button>
          </div>
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
      {/* ── Editor de días ── */}
      <div className="rounded-xl border border-digi-border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border">
          <span className="text-[12.5px] font-semibold text-digi-text" style={mf}>Horario semanal</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => applyPreset((i) => i < 5)} className={presetBtn} style={mf}>Lun–Vie</button>
            <button onClick={() => applyPreset(() => true)} className={presetBtn} style={mf}>Todos</button>
            <button onClick={() => applyPreset(() => false)} className={presetBtn} style={mf}>Ninguno</button>
          </div>
        </div>

        <div className="divide-y divide-digi-border/60">
          {DAY_KEYS.map((key, i) => {
            const on = schedule[key].active;
            return (
              <div key={key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${on ? '' : 'bg-black/[0.015]'}`}>
                <Interruptor activo={on} onChange={(v) => update(key, 'active', v)} etiqueta={`${DAYS[i]}: ${on ? 'activo' : 'descanso'}`} />
                <span className={`w-24 text-[13px] font-medium shrink-0 ${on ? 'text-digi-text' : 'text-digi-muted'}`} style={mf}>{DAYS[i]}</span>

                {on ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="time" value={schedule[key].start} onChange={(e) => update(key, 'start', e.target.value)}
                      className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <span className="text-[12px] text-digi-muted" style={mf}>a</span>
                    <input type="time" value={schedule[key].end} onChange={(e) => update(key, 'end', e.target.value)}
                      className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <span className="w-14 text-right text-[11px] text-digi-muted tabular-nums" style={mf}>{fmtNum(dayHours(schedule[key]), 1)} h</span>
                  </div>
                ) : (
                  <span className="ml-auto text-[12px] text-digi-muted italic" style={mf}>Descanso</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-digi-border">
          <button onClick={save} disabled={saving || !dirty} className={`${BTN_PRIMARY} w-full disabled:opacity-50`}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : dirty ? 'Guardar disponibilidad' : 'Guardado'}
          </button>
        </div>
      </div>

      {/* ── Resumen ── */}
      <div className="rounded-xl border border-digi-border p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center"><CalendarClock className="w-4 h-4 text-accent" /></div>
          <span className="text-[13px] font-semibold text-digi-text" style={mf}>Resumen</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-lg border border-digi-border bg-digi-darker p-3">
            <div className="flex items-center gap-1.5 text-digi-muted mb-1"><CalendarCheck className="w-3.5 h-3.5" /><span className="text-[11px] uppercase tracking-wide" style={mf}>Días</span></div>
            <p className="text-xl font-semibold text-digi-text tabular-nums leading-none" style={mf}>{activeCount}<span className="text-[12px] text-digi-muted font-normal">/7</span></p>
          </div>
          <div className="rounded-lg border border-digi-border bg-digi-darker p-3">
            <div className="flex items-center gap-1.5 text-digi-muted mb-1"><Clock3 className="w-3.5 h-3.5" /><span className="text-[11px] uppercase tracking-wide" style={mf}>Horas/sem</span></div>
            <p className="text-xl font-semibold text-accent tabular-nums leading-none" style={mf}>{fmtNum(totalHours, totalHours % 1 ? 1 : 0)}</p>
          </div>
        </div>

        {/* week dots */}
        <div className="flex items-center justify-between gap-1">
          {DAY_KEYS.map((k, i) => {
            const on = schedule[k].active;
            return (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold ${on ? 'bg-accent-light text-accent' : 'bg-black/[0.04] text-digi-muted/60'}`} style={mf} title={`${DAYS[i]}${on ? ` · ${schedule[k].start}–${schedule[k].end}` : ' · Descanso'}`}>
                  {DAY_SHORT[i]}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-digi-muted mt-3 leading-relaxed" style={mf}>Este horario define tu ventana de atención. Los miembros lo usan también en su calendario público.</p>
      </div>
    </div>
    </div>
  );
}
