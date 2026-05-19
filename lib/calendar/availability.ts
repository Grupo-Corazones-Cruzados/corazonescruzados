export type AvailabilityStatus = 'conectado' | 'ocupado' | 'descanso' | 'fuera_de_casa';

interface AvailabilityMeta {
  label: string;
  color: string;
  createsEvent: boolean;
  eventTitle?: string;
}

export const AVAILABILITY: Record<AvailabilityStatus, AvailabilityMeta> = {
  conectado: { label: 'Conectado', color: '#22c55e', createsEvent: false },
  ocupado: { label: 'Ocupado', color: '#ef4444', createsEvent: true, eventTitle: 'Ocupado' },
  descanso: { label: 'Descanso', color: '#6b7280', createsEvent: true, eventTitle: 'Descanso' },
  // El calendario tiene fondo negro puro (#000000); un color negro sería
  // invisible. Usamos un gris pizarra oscuro: lee como "ausente" y se ve.
  fuera_de_casa: { label: 'Fuera de casa', color: '#475569', createsEvent: true, eventTitle: 'Fuera de casa' },
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
