/**
 * Lo de `lib/media` que también necesita el NAVEGADOR (sin base de datos ni Google): leer el
 * id de Drive de una referencia `/api/media/<id>` y partir un nombre en base + extensión.
 */

/** El id de Drive de una referencia `/api/media/<id>` (con o sin dominio); si no es nuestra, `null`. */
export function fileIdDe(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = String(ref).match(/\/api\/media\/([A-Za-z0-9_-]{10,})(?:[?#].*)?$/);
  return m ? m[1] : null;
}

/** «Proyecto 7 · foto 03.png» → { base: «Proyecto 7 · foto 03», ext: «png» }. */
export function partirNombre(nombre: string): { base: string; ext: string } {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? { base: nombre.slice(0, i), ext: nombre.slice(i + 1) } : { base: nombre, ext: '' };
}
