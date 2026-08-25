import { prisma } from '@/lib/db';

/**
 * LOS TOPES DEL PLAN, DE VERDAD.
 *
 * Estaban guardados y no los miraba nadie: un tope que no se comprueba no es un
 * tope, es una nota. Desde que el plan dice «hasta 100 cuentas» (Fernando,
 * 2026-08-25), esto es lo que lo hace cierto.
 *
 * ⚠️ SE CUENTAN LAS CUENTAS **ACTIVAS**. Una cuenta desactivada no entra, no ocupa
 * y no consume nada; que siguiera gastando cupo obligaría a borrar personas del
 * histórico para poder dar de alta a la siguiente.
 *
 * Un tope NULO significa **sin límite**, que no es lo mismo que cero.
 */
export type Cupo = { tope: number | null; usadas: number; quedan: number | null };

export async function cupoDeCuentas(inquilinoId: number, tope: number | null): Promise<Cupo> {
  const usadas = await prisma.usuario.count({ where: { inquilinoId, activo: true } });
  return { tope, usadas, quedan: tope === null ? null : Math.max(0, tope - usadas) };
}

/**
 * Devuelve el mensaje de error si no cabe una cuenta más, o `null` si cabe.
 * El mensaje dice el número: «has llegado al tope» sin decir cuál obliga a ir a
 * buscarlo.
 */
export async function faltaCupoDeCuenta(
  inquilinoId: number,
  tope: number | null,
  aAnadir = 1,
): Promise<string | null> {
  if (tope === null) return null;
  const { usadas } = await cupoDeCuentas(inquilinoId, tope);
  if (usadas + aAnadir <= tope) return null;
  return `Tu plan permite ${tope} cuentas activas y ya tienes ${usadas}. Desactiva alguna que no se use, o escríbenos para ampliar el plan.`;
}
