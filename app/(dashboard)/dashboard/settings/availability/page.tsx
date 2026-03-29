'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface DaySchedule { active: boolean; start: string; end: string; }

const defaultSchedule = (): Record<string, DaySchedule> => {
  const s: Record<string, DaySchedule> = {};
  DAY_KEYS.forEach((k, i) => {
    s[k] = { active: i < 5, start: '09:00', end: '17:00' };
  });
  return s;
};

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState(defaultSchedule());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/users/availability')
      .then((r) => r.json())
      .then((data) => { if (data.schedule) setSchedule(data.schedule); })
      .catch(() => {});
  }, []);

  const update = (day: string, field: keyof DaySchedule, value: any) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      });
      if (!res.ok) throw new Error();
      toast.success('Disponibilidad guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="Disponibilidad" description="Configura tu horario semanal" />

      <div className="pixel-card">
        <div className="space-y-2">
          {DAY_KEYS.map((key, i) => (
            <div key={key} className="flex items-center gap-3 py-2 border-b border-digi-border/50 last:border-0">
              <label className="w-20 text-[10px] text-digi-text shrink-0" style={pf}>
                {DAYS[i]}
              </label>
              <button
                onClick={() => update(key, 'active', !schedule[key].active)}
                className={`w-10 text-[9px] py-1 border transition-colors ${
                  schedule[key].active
                    ? 'border-green-600/50 bg-green-900/20 text-green-400'
                    : 'border-digi-border bg-digi-darker text-digi-muted'
                }`}
                style={pf}
              >
                {schedule[key].active ? 'ON' : 'OFF'}
              </button>
              <input
                type="time"
                value={schedule[key].start}
                onChange={(e) => update(key, 'start', e.target.value)}
                disabled={!schedule[key].active}
                className="px-2 py-1 bg-digi-darker border border-digi-border text-xs text-digi-text disabled:opacity-30 focus:border-accent focus:outline-none"
                style={mf}
              />
              <span className="text-[9px] text-digi-muted" style={pf}>a</span>
              <input
                type="time"
                value={schedule[key].end}
                onChange={(e) => update(key, 'end', e.target.value)}
                disabled={!schedule[key].active}
                className="px-2 py-1 bg-digi-darker border border-digi-border text-xs text-digi-text disabled:opacity-30 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="pixel-btn pixel-btn-primary w-full mt-4 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Disponibilidad'}
        </button>
      </div>
    </div>
  );
}
