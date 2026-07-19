'use client';

import { CheckCircle2, XCircle, CircleDashed } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TaskStatus = 'pending' | 'completed' | 'failed';

/**
 * Botones de estado de una tarea del Horario de Vida: Completada / Fallida / Pendiente.
 * Definición ÚNICA reusable — la usan el detalle de tarea del Horario de Vida y el rail
 * de tareas de "Mi día". Completada suma a valores/talentos; fallida resta; pendiente no afecta.
 *
 * `disabled` los deja visibles pero inertes (se sigue viendo el estado actual). Lo usan las
 * tareas de eventos de **Gestión Social**, bloqueadas hasta que el usuario del sistema marque
 * el INICIO del evento.
 */
export default function TaskStatusButtons({ value, onChange, className, disabled = false }: { value: TaskStatus; onChange: (s: TaskStatus) => void; className?: string; disabled?: boolean }) {
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className || ''}`}>
      <StatusButton active={value === 'completed'} tone="completed" onClick={() => onChange('completed')} Icon={CheckCircle2} label="Completada" disabled={disabled} />
      <StatusButton active={value === 'failed'} tone="failed" onClick={() => onChange('failed')} Icon={XCircle} label="Fallida" disabled={disabled} />
      <StatusButton active={value === 'pending'} tone="pending" onClick={() => onChange('pending')} Icon={CircleDashed} label="Pendiente" disabled={disabled} />
    </div>
  );
}

function StatusButton({ active, tone, onClick, Icon, label, disabled }: { active: boolean; tone: 'completed' | 'failed' | 'pending'; onClick: () => void; Icon: any; label: string; disabled?: boolean }) {
  const base = 'inline-flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-md border text-[10.5px] font-medium transition-colors';
  // Deshabilitado: conserva el color del activo (para poder leer el estado) pero sin hover ni clic.
  const cls = disabled
    ? (tone === 'completed'
        ? (active ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'border-digi-border text-digi-muted')
        : tone === 'failed'
          ? (active ? 'bg-red-500/20 border-red-400/50 text-red-300' : 'border-digi-border text-digi-muted')
          : (active ? 'bg-white/10 border-white/25 text-digi-text' : 'border-digi-border text-digi-muted'))
    : tone === 'completed'
      ? (active ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'border-digi-border text-digi-muted hover:border-emerald-400/40 hover:text-emerald-300')
      : tone === 'failed'
        ? (active ? 'bg-red-500/20 border-red-400/50 text-red-300' : 'border-digi-border text-digi-muted hover:border-red-400/40 hover:text-red-300')
        : (active ? 'bg-white/10 border-white/25 text-digi-text' : 'border-digi-border text-digi-muted hover:border-accent/40 hover:text-digi-text');
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${cls} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} style={mf}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
