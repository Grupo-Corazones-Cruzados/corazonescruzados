'use client';

import { CheckCircle2, XCircle, CircleDashed } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TaskStatus = 'pending' | 'completed' | 'failed';

/**
 * Botones de estado de una tarea del Horario de Vida: Completada / Fallida / Pendiente.
 * Definición ÚNICA reusable — la usan el detalle de tarea del Horario de Vida y el rail
 * de tareas de "Mi día". Completada suma a valores/talentos; fallida resta; pendiente no afecta.
 */
export default function TaskStatusButtons({ value, onChange, className }: { value: TaskStatus; onChange: (s: TaskStatus) => void; className?: string }) {
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className || ''}`}>
      <StatusButton active={value === 'completed'} tone="completed" onClick={() => onChange('completed')} Icon={CheckCircle2} label="Completada" />
      <StatusButton active={value === 'failed'} tone="failed" onClick={() => onChange('failed')} Icon={XCircle} label="Fallida" />
      <StatusButton active={value === 'pending'} tone="pending" onClick={() => onChange('pending')} Icon={CircleDashed} label="Pendiente" />
    </div>
  );
}

function StatusButton({ active, tone, onClick, Icon, label }: { active: boolean; tone: 'completed' | 'failed' | 'pending'; onClick: () => void; Icon: any; label: string }) {
  const base = 'inline-flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-md border text-[10.5px] font-medium transition-colors';
  const cls = tone === 'completed'
    ? (active ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'border-digi-border text-digi-muted hover:border-emerald-400/40 hover:text-emerald-300')
    : tone === 'failed'
      ? (active ? 'bg-red-500/20 border-red-400/50 text-red-300' : 'border-digi-border text-digi-muted hover:border-red-400/40 hover:text-red-300')
      : (active ? 'bg-white/10 border-white/25 text-digi-text' : 'border-digi-border text-digi-muted hover:border-accent/40 hover:text-digi-text');
  return (
    <button onClick={onClick} className={`${base} ${cls}`} style={mf}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
