import type { EstadoReserva, EstadoPagoReserva } from '@/generated/prisma/enums';
import { diaDe, inicioDelDiaEn, finDelDiaEn, type Dia } from '@/lib/fechas';

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

/** Noches entre dos fechas, mínimo 1: una estancia de un día es una noche. (Zona local del proceso.) */
export function noches(entrada: Date, salida: Date) {
  const ms = inicioDelDia(salida).getTime() - inicioDelDia(entrada).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Noches contadas con los días del hotel, para el servidor (que corre en UTC). */
export function nochesEn(entrada: Date, salida: Date, zonaHoraria: string) {
  const [a1, m1, d1] = diaDe(entrada, zonaHoraria).split('-').map(Number);
  const [a2, m2, d2] = diaDe(salida, zonaHoraria).split('-').map(Number);
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1);
  return Math.max(1, Math.round(ms / 86_400_000));
}

/**
 * EL ESTADO DEL PAGO NO SE ELIGE: SE DERIVA (Fernando, 2026-09-20). Está pagada
 * cuando lo pagado cubre el precio total. Se calcula en el servidor al guardar,
 * así la columna sigue valiendo para filtrar y para los reportes.
 */
export function estadoPagoDe(precioTotal: number, anticipo: number): EstadoPagoReserva {
  return anticipo >= precioTotal ? 'PAGADO' : 'PENDIENTE';
}

/**
 * ¿La reserva sale dentro de ese día del hotel? Es lo que pinta un bloque como
 * «por salir» en la agenda: el estado POR_SALIR ya no se escribe a mano.
 */
export function saleEnElDia(salida: Date, dia: Dia, zonaHoraria: string) {
  return salida >= inicioDelDiaEn(dia, zonaHoraria) && salida <= finDelDiaEn(dia, zonaHoraria);
}
