import type { DiaSemana, EstadoServicio } from '@/generated/prisma/enums';
import { aDia, diaSemanaDe, sumarDias, type Dia } from '@/lib/fechas';

/**
 * LA ARITMÉTICA DEL SERVICIO.
 *
 * Los días consumidos y la fecha de fin NO se guardan: se calculan desde el
 * inicio, avanzando por los días de la semana contratados y saltando los feriados
 * no laborables y las cancelaciones activas. Así el número es el mismo lo mire
 * quien lo mire y no depende de que un cron haya corrido anoche (fue la lección
 * del proyecto de referencia: commit «Eliminar dependencia del cron»).
 */

export type ServicioBase = {
  diasTotales: number;
  fechaInicio: Date;
  diasSemana: DiaSemana[];
  porcentajeCancelacion: number;
  estado: EstadoServicio;
  terminoEn: Date | null;
};

/** ¿Cuenta este día? Es día contratado, no es feriado y no está cancelado. */
const cuenta = (dia: Dia, dias: Set<DiaSemana>, feriados: Set<Dia>, canceladas: Set<Dia>) =>
  dias.has(diaSemanaDe(dia)) && !feriados.has(dia) && !canceladas.has(dia);

/** Cuántos días de servicio hay desde el inicio hasta `hasta` (inclusive). */
export function calcularDiasConsumidos(
  s: Pick<ServicioBase, 'diasTotales' | 'fechaInicio' | 'diasSemana'>,
  hasta: Dia,
  feriados: Set<Dia>,
  canceladas: Set<Dia>,
) {
  const dias = new Set(s.diasSemana);
  if (!dias.size) return 0;
  let n = 0;
  let cursor = aDia(s.fechaInicio);
  // El tope es el total: pasado el último día, ya no se consume nada más.
  while (cursor <= hasta && n < s.diasTotales) {
    if (cuenta(cursor, dias, feriados, canceladas)) n++;
    cursor = sumarDias(cursor, 1);
  }
  return n;
}

/** El día en que se consume el último día contratado. */
export function calcularFechaFin(
  s: Pick<ServicioBase, 'diasTotales' | 'fechaInicio' | 'diasSemana'>,
  feriados: Set<Dia>,
  canceladas: Set<Dia>,
): Dia {
  const dias = new Set(s.diasSemana);
  let cursor = aDia(s.fechaInicio);
  if (!dias.size || s.diasTotales <= 0) return cursor;
  let n = 0;
  // Tope de seguridad: con un día de la semana como mínimo, N días caben en 7N
  // semanas; los feriados y cancelaciones no llegan a duplicarlo.
  for (let i = 0; i < s.diasTotales * 14 + 366; i++) {
    if (cuenta(cursor, dias, feriados, canceladas)) {
      n++;
      if (n === s.diasTotales) return cursor;
    }
    cursor = sumarDias(cursor, 1);
  }
  return cursor;
}

/** ¿El servicio sirve comida ESTE día? (vigente, día contratado, sin feriado ni cancelación, dentro del plazo) */
export function sirveEl(
  s: ServicioBase,
  dia: Dia,
  feriados: Set<Dia>,
  canceladas: Set<Dia>,
  fechaFin = calcularFechaFin(s, feriados, canceladas),
) {
  if (s.estado !== 'ACTIVO') return false;
  if (dia < aDia(s.fechaInicio) || dia > fechaFin) return false;
  return cuenta(dia, new Set(s.diasSemana), feriados, canceladas);
}

export type ResumenServicio = {
  fechaFin: Dia;
  diasConsumidos: number;
  diasRestantes: number;
  /** ACTIVO · VENCE_HOY · VENCIDO · SUSPENDIDO — lo que se ENSEÑA, deducido del calendario. */
  situacion: 'ACTIVO' | 'VENCE_HOY' | 'VENCIDO' | 'SUSPENDIDO';
  maxCancelaciones: number;
  cancelacionesUsadas: number;
};

export function resumirServicio(
  s: ServicioBase,
  hoy: Dia,
  feriados: Set<Dia>,
  canceladas: Set<Dia>,
): ResumenServicio {
  const fechaFin = calcularFechaFin(s, feriados, canceladas);
  const hasta = hoy < fechaFin ? hoy : fechaFin;
  const diasConsumidos = calcularDiasConsumidos(s, hasta, feriados, canceladas);
  const maxCancelaciones = Math.floor((s.diasTotales * s.porcentajeCancelacion) / 100);
  const inicio = aDia(s.fechaInicio);
  const cancelacionesUsadas = [...canceladas].filter((d) => d >= inicio).length;

  let situacion: ResumenServicio['situacion'];
  if (s.estado === 'SUSPENDIDO') situacion = 'SUSPENDIDO';
  else if (s.estado === 'VENCIDO' || fechaFin < hoy) situacion = 'VENCIDO';
  else if (fechaFin === hoy) situacion = 'VENCE_HOY';
  else situacion = 'ACTIVO';

  return {
    fechaFin,
    diasConsumidos,
    diasRestantes: Math.max(0, s.diasTotales - diasConsumidos),
    situacion,
    maxCancelaciones,
    cancelacionesUsadas,
  };
}

export const ETIQUETA_SITUACION: Record<ResumenServicio['situacion'], string> = {
  ACTIVO: 'Activo',
  VENCE_HOY: 'Vence hoy',
  VENCIDO: 'Vencido',
  SUSPENDIDO: 'Suspendido',
};

export const TONO_SITUACION: Record<ResumenServicio['situacion'], 'exito' | 'aviso' | 'error' | 'neutro'> = {
  ACTIVO: 'exito',
  VENCE_HOY: 'aviso',
  VENCIDO: 'error',
  SUSPENDIDO: 'neutro',
};

/** Un día del calendario del servicio, para pintarlo. */
export type DiaCalendario = {
  dia: Dia;
  /** SERVIDO (ya pasó y contó) · PENDIENTE (contará) · CANCELADO · FERIADO · SIN_SERVICIO (no es día contratado) */
  estado: 'SERVIDO' | 'PENDIENTE' | 'CANCELADO' | 'FERIADO' | 'SIN_SERVICIO';
  cancelacionId?: number;
  motivo?: string | null;
};

/**
 * Todos los días entre el inicio y el fin del servicio, cada uno con lo que es.
 * Lo usan la ficha del personal y el portal del cliente, con el mismo criterio
 * que la aritmética de arriba.
 */
export function calendarioServicio(
  s: ServicioBase,
  hoy: Dia,
  feriados: Set<Dia>,
  cancelaciones: { id: number; dia: Dia; motivo: string | null }[],
): DiaCalendario[] {
  const canceladas = new Set(cancelaciones.map((c) => c.dia));
  const fin = calcularFechaFin(s, feriados, canceladas);
  const dias = new Set(s.diasSemana);
  const salida: DiaCalendario[] = [];
  let cursor = aDia(s.fechaInicio);
  while (cursor <= fin) {
    if (!dias.has(diaSemanaDe(cursor))) salida.push({ dia: cursor, estado: 'SIN_SERVICIO' });
    else if (canceladas.has(cursor)) {
      const c = cancelaciones.find((x) => x.dia === cursor)!;
      salida.push({ dia: cursor, estado: 'CANCELADO', cancelacionId: c.id, motivo: c.motivo });
    } else if (feriados.has(cursor)) salida.push({ dia: cursor, estado: 'FERIADO' });
    else salida.push({ dia: cursor, estado: cursor < hoy || (cursor === hoy) ? 'SERVIDO' : 'PENDIENTE' });
    cursor = sumarDias(cursor, 1);
  }
  return salida;
}
