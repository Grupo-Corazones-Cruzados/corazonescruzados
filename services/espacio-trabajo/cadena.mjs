/**
 * SKILLS ENCADENADAS. Fernando escribe «/memoria /aprendizaje /diseno <petición>». La terminal las
 * carga todas, pero este motor solo ejecuta la primera y recibe las demás como texto (probado el
 * 2026-11-04 con 2.1.318). Por eso las siguientes se piden con la herramienta oficial de skills.
 */
const MARCA = '[Además de la anterior, antes de responder invoca con la herramienta Skill, en este orden y sobre esta misma petición: ';

/** Lo que recibe el motor. Solo cuenta lo que es un comando real, en fila, al principio del mensaje. */
export function expandirCadena(texto, nombres) {
  const conocidos = nombres instanceof Set ? nombres : new Set(nombres);
  const cadena = [];
  let resto = String(texto || '');
  for (;;) {
    const m = resto.match(/^\/([\w:-]+)(?:\s+|$)/);
    if (!m || !conocidos.has(m[1])) break;
    cadena.push(m[1]);
    resto = resto.slice(m[0].length);
  }
  if (cadena.length < 2) return texto;
  return `/${cadena[0]} ${resto}`.trimEnd() + `\n\n${MARCA}${cadena.slice(1).join(', ')}.]`;
}

/** Lo que se ve en pantalla: lo que escribió la persona. Sirve también para el historial. */
export function plegarCadena(texto) {
  const t = String(texto);
  const i = t.indexOf(MARCA);
  if (i < 0) return t;
  const fin = t.indexOf('.]', i);
  if (fin < 0) return t;
  const otras = t.slice(i + MARCA.length, fin).split(', ').map((n) => `/${n}`).join(' ');
  const antes = t.slice(0, i).trimEnd();
  const despues = t.slice(fin + 2);
  const m = antes.match(/^\/[\w:-]+/);
  if (!m) return t;
  return `${m[0]} ${otras}${antes.slice(m[0].length)}${despues}`.trim();
}
