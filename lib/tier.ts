/**
 * EL TIER DE DESARROLLO HUMANO (Fernando, 2026-11-09: modelo económico, MEMORIA.md › «Decisiones y reglas de
 * negocio»). Según lo GENERADO acumulado por la cuenta, la plataforma le cobra una anualidad: gratis mientras
 * empieza y cada vez más a quien más beneficio sacó de ella. Aplica a miembros y candidatos; lo cobrado va a la
 * cuenta del SRI del administrador.
 *
 * «Generado» = ingresos FACTURADOS de su estado financiero (todos los meses). Los adicionales no cuentan: los
 * escribe cada uno a mano y el tier se cobra sobre lo que se puede comprobar.
 *
 * Una sola tabla para todo (Inicio hoy; el cobro de la anualidad mañana). El último escalón no sube más.
 */
export const TIERS = [
  { tier: 0, desde: 0, anual: 0 },
  { tier: 1, desde: 5_000, anual: 30 },
  { tier: 2, desde: 20_000, anual: 100 },
  { tier: 3, desde: 50_000, anual: 200 },
  { tier: 4, desde: 75_000, anual: 300 },
  { tier: 5, desde: 100_000, anual: 400 },
] as const;

export type Tier = (typeof TIERS)[number];

/** El tier que corresponde a lo generado y el siguiente escalón (null en el último). */
export function tierDe(generado: number): { actual: Tier; siguiente: Tier | null } {
  let i = 0;
  while (i + 1 < TIERS.length && generado >= TIERS[i + 1].desde) i++;
  return { actual: TIERS[i], siguiente: TIERS[i + 1] ?? null };
}
