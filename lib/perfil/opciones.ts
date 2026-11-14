/**
 * LAS OPCIONES DEL PERFIL, en un solo sitio (2026-11-14): las usan Configuración (Perfil y Disponibilidad) y el
 * formulario de alta del candidato, que pide los mismos datos. Una lista distinta en cada pantalla acabaría
 * guardando valores que la otra no reconoce.
 */
export const IDIOMAS = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Chino (Mandarín)', 'Japonés', 'Coreano', 'Ruso', 'Árabe', 'Kichwa', 'Catalán', 'Neerlandés', 'Hindi'];

export type EstadoLaboral = 'immediate' | 'from_date' | 'not_available';
// Textos cortos: van en un segmentado de tres en 390 px (2026-10-30).
export const ESTADOS: { v: EstadoLaboral; label: string }[] = [
  { v: 'immediate', label: 'De inmediato' },
  { v: 'from_date', label: 'Desde una fecha' },
  { v: 'not_available', label: 'No disponible' },
];
export const JORNADAS = [
  { v: 'full', label: 'Completa' },
  { v: 'part', label: 'Media jornada' },
  { v: 'both', label: 'Cualquiera' },
];
export const MODALIDADES = [
  { v: 'remote', label: 'Remoto' },
  { v: 'hybrid', label: 'Híbrido' },
  { v: 'onsite', label: 'Presencial' },
  { v: 'any', label: 'Cualquiera' },
];

/** Los días del horario semanal, en el orden de `member_schedules.day_of_week` (1 = lunes … 7 = domingo). */
export const DIAS_SEMANA = [
  { k: 'monday', label: 'Lunes' }, { k: 'tuesday', label: 'Martes' }, { k: 'wednesday', label: 'Miércoles' },
  { k: 'thursday', label: 'Jueves' }, { k: 'friday', label: 'Viernes' }, { k: 'saturday', label: 'Sábado' },
  { k: 'sunday', label: 'Domingo' },
] as const;
