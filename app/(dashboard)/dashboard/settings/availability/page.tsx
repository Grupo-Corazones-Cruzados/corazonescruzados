'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import { ChevronLeft } from 'lucide-react';

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

const mf = { fontFamily: 'var(--font-body)' } as const;

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
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}>
        <ChevronLeft className="w-4 h-4" /> Configuración
      </Link>
      <PageHeader title="Disponibilidad" description="Configura tu horario semanal" />

      <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-5">
        <div className="divide-y divide-digi-border/60">
          {DAY_KEYS.map((key, i) => {
            const on = schedule[key].active;
            return (
              <div key={key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-24 text-[13px] font-medium text-digi-text shrink-0" style={mf}>{DAYS[i]}</span>
                <button
                  onClick={() => update(key, 'active', !on)}
                  className={`inline-flex items-center justify-center min-w-[72px] px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
                    on ? 'bg-accent-light text-accent border border-accent/30' : 'bg-black/[0.04] text-digi-muted border border-transparent'
                  }`}
                  style={mf}
                >
                  {on ? 'Activo' : 'Inactivo'}
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="time"
                    value={schedule[key].start}
                    onChange={(e) => update(key, 'start', e.target.value)}
                    disabled={!on}
                    className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text disabled:opacity-40 focus:border-accent focus:outline-none"
                    style={mf}
                  />
                  <span className="text-[12px] text-digi-muted" style={mf}>a</span>
                  <input
                    type="time"
                    value={schedule[key].end}
                    onChange={(e) => update(key, 'end', e.target.value)}
                    disabled={!on}
                    className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text disabled:opacity-40 focus:border-accent focus:outline-none"
                    style={mf}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={save} disabled={saving} className="pixel-btn pixel-btn-primary w-full mt-5 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar disponibilidad'}
        </button>
      </div>
    </div>
  );
}
