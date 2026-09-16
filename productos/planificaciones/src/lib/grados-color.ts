/**
 * EL COLOR DE CADA GRADO (Fernando, 2026-09-16): un relleno que se asigna al azar
 * al crear el grado y que lo distingue de la materia en los controles de
 * selección (el horario, sus celdas, los chips de horas). Paleta clara: el texto
 * encima siempre es oscuro, en el tema claro y en el oscuro. Sin `pg`: lo usan
 * componentes de cliente.
 */
export const PALETA_GRADOS = ['#FCA5A5', '#FDBA74', '#FCD34D', '#BEF264', '#86EFAC', '#5EEAD4', '#7DD3FC', '#A5B4FC', '#C4B5FD', '#F0ABFC', '#F9A8D4', '#D6D3D1'] as const;

/** Un color al azar, evitando los que ya usan otros grados mientras queden libres. */
export function colorAleatorio(usados: string[] = []): string {
  const libres = PALETA_GRADOS.filter((c) => !usados.includes(c));
  const bolsa = libres.length ? libres : [...PALETA_GRADOS];
  return bolsa[Math.floor(Math.random() * bolsa.length)];
}

export const esColorDeGrado = (c: unknown): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);

/** El texto que va sobre el relleno: la paleta es clara, así que siempre oscuro. */
export const TEXTO_SOBRE_GRADO = '#1F2937';
