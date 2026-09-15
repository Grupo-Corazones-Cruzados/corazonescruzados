import { prisma } from '@/lib/db';

/**
 * LOS TOPES DEL PLAN, DE VERDAD.
 *
 * Un tope que no se comprueba no es un tope, es una nota. El plan dice «hasta
 * 100 cuentas» y esto es lo que lo hace cierto.
 *
 * ⚠️ SE CUENTAN LAS CUENTAS DEL PERSONAL **ACTIVAS**. Los clientes finales NO
 * cuentan (Fernando, 2026-09-15): un negocio con 101 comensales sigue aprobando
 * al siguiente. Una cuenta desactivada no ocupa ni consume.
 *
 * Un tope NULO significa **sin límite**, que no es lo mismo que cero.
 */
export type Cupo = { tope: number | null; usadas: number; quedan: number | null };

export async function cupoDeCuentas(inquilinoId: number, tope: number | null): Promise<Cupo> {
  const usadas = await prisma.usuario.count({ where: { inquilinoId, activo: true } });
  return { tope, usadas, quedan: tope === null ? null : Math.max(0, tope - usadas) };
}

/** Devuelve el mensaje de error si no cabe una cuenta más, o `null` si cabe. */
export async function faltaCupoDeCuenta(
  inquilinoId: number,
  tope: number | null,
  aAnadir = 1,
): Promise<string | null> {
  if (tope === null) return null;
  const { usadas } = await cupoDeCuentas(inquilinoId, tope);
  if (usadas + aAnadir <= tope) return null;
  return `Tu plan permite ${tope} cuentas activas del personal y ya tienes ${usadas}. Desactiva alguna que no se use, o escríbenos para ampliar el plan.`;
}
