// Formato numérico de presentación (locale es-ES): miles con ".", decimales con ",".
// Fuente única para mostrar cantidades en la UI. Reemplaza a `.toFixed()` en presentación.
// NO usar para XML del SRI, PDFs ni cuerpos de API (esos requieren punto decimal).

const cache: Record<string, Intl.NumberFormat> = {};
function nf(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  return (cache[key] ||= new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max }));
}

/** Número con exactamente 2 decimales (es-ES). Reemplazo de `.toFixed(2)` para presentación. */
export function fmt2(n: number | string | null | undefined): string {
  const v = typeof n === 'number' ? n : Number(n);
  return nf(2, 2).format(isFinite(v) ? v : 0);
}

/** Número con `decimals` decimales fijos (es-ES). Reemplazo de `.toFixed(d)`. */
export function fmtNum(n: number | string | null | undefined, decimals = 0): string {
  const v = typeof n === 'number' ? n : Number(n);
  return nf(decimals, decimals).format(isFinite(v) ? v : 0);
}

/** Entero con separador de miles (es-ES). */
export function fmtInt(n: number | string | null | undefined): string {
  const v = typeof n === 'number' ? n : Number(n);
  return nf(0, 0).format(isFinite(v) ? Math.round(v) : 0);
}

/** Moneda: `$` + 2 decimales es-ES (p. ej. $1.234,56). */
export function money(n: number | string | null | undefined): string {
  return `$${fmt2(n)}`;
}
