/**
 * LA PALABRA CLAVE. Whisper no conoce «GUMDRAMON» y lo escribe de mil formas (gundramón, gum dramon,
 * gamdramon…), así que se compara por parecido y no por texto exacto. Solo se busca en el micrófono:
 * lo que diga el cliente nunca puede dar una orden.
 */
const CLAVE = 'gumdramon';
const TOLERANCIA = 2;
const DRAGON = /^g[aou]m?n?drag[oa]n$/; // whisper oye «dragón» donde dice «dramon»

export const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1));
      previo = guardado;
    }
  }
  return fila[b.length];
}

/** Parecido a la clave: empieza como ella (g…) y acaba como ella (…mon, …man), para no confundir palabras comunes. */
function esClave(t) {
  return DRAGON.test(t) || (t.length >= 6 && /[gwk]/.test(t[0]) && /m[oa]n?$/.test(t) && distancia(t, CLAVE) <= TOLERANCIA);
}

/** Busca la clave en una o dos palabras seguidas. Devuelve lo que se dijo después, o null si no está. */
export function buscarClave(texto) {
  const original = String(texto || '').trim();
  const palabras = [...original.matchAll(/[\p{L}\p{N}]+/gu)];
  const planas = palabras.map((m) => normalizar(m[0]));
  for (let i = 0; i < planas.length; i++) {
    for (const n of [1, 2, 3]) {
      if (i + n > planas.length) continue;
      if (esClave(planas.slice(i, i + n).join(''))) {
        const ultima = palabras[i + n - 1];
        return { resto: original.slice(ultima.index + ultima[0].length).replace(/^[\s,.:;!¡?¿-]+/, '').trim() };
      }
    }
  }
  return null;
}

/** «la sesión ha terminado», «termina la reunión», «fin de la sesión», «cierra la sesión»… */
export function ordenaTerminar(resto) {
  const t = normalizar(resto);
  const asunto = /\b(sesion|reunion)\b/.test(t);
  const accion = /\b(termin\w*|finaliz\w*|acab\w*|cierr\w*|cerr\w*|fin)\b/.test(t);
  return asunto && accion && t.split(/\s+/).length <= 8;
}
