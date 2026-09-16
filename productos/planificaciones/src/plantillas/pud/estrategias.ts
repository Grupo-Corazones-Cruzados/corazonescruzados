/**
 * LAS ESTRATEGIAS METODOLÓGICAS COMO TEXTO. Se guardan en una sola columna de
 * texto para que el docente pueda corregirlas en un cuadro normal, con dos
 * convenciones que la pantalla y el PDF saben leer:
 *
 *   ## ACTIVACIÓN DE CONOCIMIENTOS PREVIOS (A)     ← una fase (las tres del ciclo ACC)
 *   Reconocer la propia emoción ante…             ← una actividad (un párrafo)
 *   • ¿Cómo me siento cuando…?                    ← una pregunta o viñeta de la actividad anterior
 *   https://youtu.be/…                            ← un enlace: va en su propia línea
 */

export const FASES = [
  { clave: 'activacion', titulo: 'ACTIVACIÓN DE CONOCIMIENTOS PREVIOS (A)' },
  { clave: 'construccion', titulo: 'CONSTRUCCIÓN DEL CONOCIMIENTO (C)' },
  { clave: 'consolidacion', titulo: 'CONSOLIDACIÓN DEL APRENDIZAJE (C)' },
] as const;

export type ClaveFase = (typeof FASES)[number]['clave'];

/** Una actividad: su párrafo y sus viñetas (preguntas). */
export type Actividad = { texto: string; vinetas: string[] };
export type Fase = { clave: ClaveFase | null; titulo: string; actividades: Actividad[] };

const esVineta = (l: string) => /^[•\-*]\s+/.test(l);
const limpiarVineta = (l: string) => l.replace(/^[•\-*]\s+/, '').trim();

export function parsearEstrategias(texto: string | null | undefined): Fase[] {
  const fases: Fase[] = [];
  let actual: Fase | null = null;
  for (const cruda of (texto ?? '').split('\n')) {
    const l = cruda.trim();
    if (!l) continue;
    if (l.startsWith('## ')) {
      const titulo = l.slice(3).trim();
      const def = FASES.find((f) => f.titulo.toUpperCase() === titulo.toUpperCase());
      actual = { clave: def?.clave ?? null, titulo: def?.titulo ?? titulo, actividades: [] };
      fases.push(actual);
      continue;
    }
    if (!actual) {
      actual = { clave: null, titulo: '', actividades: [] };
      fases.push(actual);
    }
    if (esVineta(l) && actual.actividades.length) actual.actividades[actual.actividades.length - 1].vinetas.push(limpiarVineta(l));
    else actual.actividades.push({ texto: l, vinetas: [] });
  }
  return fases;
}

/** Lo que devuelve el agente (tres listas) → el texto que se guarda. */
export function serializarEstrategias(s: Record<ClaveFase, string[]>): string {
  return FASES.map((f) => [`## ${f.titulo}`, ...(s[f.clave] ?? []).map((a) => a.trim()).filter(Boolean)].join('\n')).join('\n\n');
}

/** Líneas no vacías de un campo «uno por línea» (recursos, técnica, instrumento). */
export const lineas = (t: string | null | undefined) =>
  (t ?? '')
    .split('\n')
    .map((l) => l.replace(/^[•\-*]\s+/, '').trim())
    .filter(Boolean);
