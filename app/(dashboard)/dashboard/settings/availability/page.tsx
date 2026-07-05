'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { fmtNum } from '@/lib/format';
import { ChevronLeft, CalendarClock, Clock3, CalendarCheck, Save } from 'lucide-react';

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

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/users/availability')
      .then((r) => r.json())
      .then((data) => { if (data.schedule) setSchedule(data.schedule); })
      .catch(() => {});
  }, []);

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

  return (
    <div>
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}>
        <ChevronLeft className="w-4 h-4" /> Configuración
      </Link>
      <PageHeader title="Disponibilidad" description="Configura tu horario semanal de atención" />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        {/* ── Editor de días ── */}
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-digi-border">
            <span className="text-[13px] font-semibold text-digi-text" style={mf}>Horario semanal</span>
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
                  {/* switch */}
                  <button
                    role="switch" aria-checked={on} onClick={() => update(key, 'active', !on)}
                    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-digi-border'}`}
                    title={on ? 'Desactivar' : 'Activar'}
                  >
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform" style={{ background: '#fff', transform: on ? 'translateX(16px)' : 'none' }} />
                  </button>
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
        <aside className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4 lg:sticky lg:top-4">
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
        </aside>
      </div>
    </div>
  );
}
