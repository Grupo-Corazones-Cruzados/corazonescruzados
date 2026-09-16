import { prisma } from '@/lib/db';
import { inicioDeSemanaEn } from '@/lib/fechas';

/**
 * LOS TOPES DEL PLAN, DE VERDAD. Un tope que no se comprueba no es un tope, es
 * una nota. Este producto tiene DOS (Fernando, 2026-09-15): hasta 100 cuentas y
 * hasta 40 planificaciones semanales generadas por semana para toda la
 * institución, no por docente.
 *
 * Un tope NULO significa **sin límite**, que no es lo mismo que cero.
 */
export type Cupo = { tope: number | null; usadas: number; quedan: number | null };

const armar = (tope: number | null, usadas: number): Cupo => ({
  tope,
  usadas,
  quedan: tope === null ? null : Math.max(0, tope - usadas),
});

// ── Cuentas ─────────────────────────────────────────────────────────────────

/** Se cuentan las cuentas ACTIVAS: una desactivada no ocupa. */
export async function cupoDeCuentas(inquilinoId: number, tope: number | null): Promise<Cupo> {
  const usadas = await prisma.usuario.count({ where: { inquilinoId, activo: true } });
  return armar(tope, usadas);
}

/** Devuelve el mensaje de error si no cabe una cuenta más, o `null` si cabe. */
export async function faltaCupoDeCuenta(inquilinoId: number, tope: number | null, aAnadir = 1): Promise<string | null> {
  if (tope === null) return null;
  const { usadas } = await cupoDeCuentas(inquilinoId, tope);
  if (usadas + aAnadir <= tope) return null;
  return `Tu plan permite ${tope} cuentas activas y ya tienes ${usadas}. Desactiva alguna que no se use, o escríbenos para ampliar el plan.`;
}

// ── Generaciones por semana ─────────────────────────────────────────────────

/**
 * Se cuentan las planificaciones semanales creadas desde el LUNES a las 0:00 en
 * la zona horaria de la institución. Las que fallaron (ERROR) no cuentan: nadie
 * paga por lo que no recibió.
 */
export async function cupoDeGeneraciones(
  inq: { id: number; zonaHoraria: string },
  tope: number | null,
): Promise<Cupo & { desde: Date }> {
  const desde = inicioDeSemanaEn(inq.zonaHoraria);
  const usadas = await prisma.planificacionSemanal.count({
    where: { inquilinoId: inq.id, creado: { gte: desde }, estado: { not: 'ERROR' } },
  });
  return { ...armar(tope, usadas), desde };
}

export async function faltaCupoDeGeneracion(
  inq: { id: number; zonaHoraria: string },
  tope: number | null,
): Promise<string | null> {
  if (tope === null) return null;
  const { usadas } = await cupoDeGeneraciones(inq, tope);
  if (usadas < tope) return null;
  return `Tu plan permite ${tope} planificaciones semanales por semana para toda la institución y esta semana ya se generaron ${usadas}. El contador vuelve a cero el lunes.`;
}
