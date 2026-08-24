import type { EstadoReserva } from '@/generated/prisma/enums';

/**
 * Estado de una suite HOY. No es una columna: se deduce de sus reservas, porque
 * guardarlo obligaría a mantenerlo al día con el paso del tiempo — y el tiempo
 * pasa sin que nadie pulse nada.
 */
export type EstadoSuite = 'libre' | 'ocupada' | 'por-salir';

export type ReservaMinima = {
  entrada: Date;
  salida: Date;
  estado: EstadoReserva;
};

export const VIVAS: EstadoReserva[] = ['OCUPADA', 'POR_SALIR'];

export function inicioDelDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function finDelDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** ¿La reserva cubre algún momento de hoy? */
export function activaHoy(r: ReservaMinima, ahora = new Date()) {
  return r.entrada <= finDelDia(ahora) && r.salida >= inicioDelDia(ahora);
}

export function estadoDeSuite(reservas: ReservaMinima[], ahora = new Date()): EstadoSuite {
  const hoy = reservas.filter((r) => VIVAS.includes(r.estado) && activaHoy(r, ahora));
  if (!hoy.length) return 'libre';
  // Sale hoy: la salida cae dentro del día en curso.
  if (hoy.some((r) => r.estado === 'POR_SALIR' || r.salida <= finDelDia(ahora))) return 'por-salir';
  return 'ocupada';
}

export const ETIQUETA_ESTADO_SUITE: Record<EstadoSuite, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  'por-salir': 'Por salir',
};

export const TONO_ESTADO_SUITE = {
  libre: 'exito',
  ocupada: 'info',
  'por-salir': 'aviso',
} as const;

export const ETIQUETA_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  OCUPADA: 'Ocupada',
  POR_SALIR: 'Por salir',
  FINALIZADA: 'Finalizada',
  ELIMINADA: 'Eliminada',
};

export const TONO_ESTADO_RESERVA = {
  OCUPADA: 'info',
  POR_SALIR: 'aviso',
  FINALIZADA: 'exito',
  ELIMINADA: 'neutro',
} as const;

/** Noches entre dos fechas, mínimo 1: una estancia de un día es una noche. */
export function noches(entrada: Date, salida: Date) {
  const ms = inicioDelDia(salida).getTime() - inicioDelDia(entrada).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}
