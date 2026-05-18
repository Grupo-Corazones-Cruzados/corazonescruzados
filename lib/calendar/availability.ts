export type AvailabilityStatus = 'conectado' | 'ocupado' | 'descanso' | 'fuera_de_casa';

interface AvailabilityMeta {
  label: string;
  color: string;
  createsTask: boolean;
  taskTitle?: string;
}

export const AVAILABILITY: Record<AvailabilityStatus, AvailabilityMeta> = {
  conectado: { label: 'Conectado', color: '#22c55e', createsTask: false },
  ocupado: { label: 'Ocupado', color: '#ef4444', createsTask: true, taskTitle: 'Ocupado' },
  descanso: { label: 'Descanso', color: '#6b7280', createsTask: true, taskTitle: 'Descanso' },
  fuera_de_casa: { label: 'Fuera de casa', color: '#000000', createsTask: true, taskTitle: 'Fuera de casa' },
};

export const AVAILABILITY_ORDER: AvailabilityStatus[] = [
  'conectado',
  'ocupado',
  'descanso',
  'fuera_de_casa',
];

export function isAvailabilityStatus(v: unknown): v is AvailabilityStatus {
  return typeof v === 'string' && v in AVAILABILITY;
}
