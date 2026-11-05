/**
 * ¿DOS TRANSCRIPCIONES SON LA MISMA REUNIÓN? El Copiloto y Google Meet oyen lo mismo, pero transcriben
 * distinto y pueden empezar en momentos diferentes. Por eso se compara por pares de palabras seguidas y
 * sobre el texto más corto: si el Copiloto se activó a la mitad, lo suyo sigue estando dentro de lo de Meet.
 *
 * Se quitan horas y nombres de quien habla, porque cada transcriptor los escribe a su manera.
 */
const MINIMO_PARES = 60; // con menos texto cualquiera se parece

/**
 * Medido el 2026-11-05 con 12 transcripciones reales de Meet: reuniones distintas dan 0,29 de mediana y
 * 0,46 como máximo; la misma reunión pasada por Whisper, 0,93 (con voz sintética, así que es optimista).
 * Si no se alcanza, se crea un recordatorio aparte: un duplicado se borra, una transcripción perdida no.
 */
export const UMBRAL_MISMA_REUNION = 0.65;

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Horas sueltas y «Nombre:» al principio de cada línea. */
const soloDicho = (t: string) => t.split('\n')
  .map((l) => l.replace(/^\s*\[?\d{1,2}:\d{2}(:\d{2})?( ?[ap]\.? ?m\.?)?\]?\s*/i, '').replace(/^[^:\n]{1,40}:\s/, ''))
  .join(' ');

function pares(t: string): Map<string, number> {
  const p = normalizar(soloDicho(t)).match(/[\p{L}\p{N}]+/gu) || [];
  const m = new Map<string, number>();
  for (let i = 0; i + 1 < p.length; i++) {
    const k = `${p[i]} ${p[i + 1]}`;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/** De 0 a 1: qué parte de la transcripción más corta aparece en la otra. */
export function parecidoTranscripciones(a: string, b: string): number {
  const x = pares(a);
  const y = pares(b);
  const totalX = [...x.values()].reduce((s, n) => s + n, 0);
  const totalY = [...y.values()].reduce((s, n) => s + n, 0);
  const menor = Math.min(totalX, totalY);
  if (menor < MINIMO_PARES) return 0;
  let comunes = 0;
  for (const [k, n] of x) comunes += Math.min(n, y.get(k) || 0);
  return comunes / menor;
}
