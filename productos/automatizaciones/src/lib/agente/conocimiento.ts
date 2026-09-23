/**
 * Arma el bloque de CONOCIMIENTO del prompt, y calcula qué bloques están pendientes.
 *
 * Esta es la **única** función que arma ese bloque, y la usan tanto el runner como el
 * Estudio. Si divergieran, lo que el cliente ve en pantalla no sería lo que recibe el
 * modelo — un bug por construcción, evitado por construcción.
 *
 * Módulo **puro**: sin `pg`, sin red, sin entorno. Se prueba en seco.
 *
 * ⇒ EL CÁLCULO DE PENDIENTES ES LA PIEZA QUE ARREGLA UN FALLO REAL.
 * En Peters Tours, el prompt de reglas dice que escale porque el conocimiento está
 * `[PENDIENTE]` en pagos y horario de atención — pero el cliente ya los rellenó. El
 * agente pasa a una persona preguntas que sabe contestar, y nadie se entera. Ahí la
 * lista está escrita a mano en el prompt; aquí se CALCULA del conocimiento y se inyecta.
 * Con N clientes, mantener esa lista a mano no es viable.
 */

/** Un bloque de conocimiento, tal como vive en `agente_conocimiento`. */
export interface BloqueConocimiento {
  clave: string;
  titulo: string;
  contenido: string;
  orden?: number;
  activo?: boolean;
}

/** La marca que el cliente deja en un bloque que aún no ha rellenado. */
export const MARCA_PENDIENTE = '[PENDIENTE';

/** ¿Este bloque está a medias? Tolerante: `[PENDIENTE]` y `[PENDIENTE: lo que sea]`. */
export function estaPendiente(bloque: BloqueConocimiento): boolean {
  return bloque.contenido.toUpperCase().includes(MARCA_PENDIENTE);
}

/** Los bloques vacíos también cuentan como pendientes: un título sin texto no informa de nada. */
export function estaVacio(bloque: BloqueConocimiento): boolean {
  return bloque.contenido.trim().length === 0;
}

function ordenar(bloques: BloqueConocimiento[]): BloqueConocimiento[] {
  return [...bloques]
    .filter((b) => b.activo !== false)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.clave.localeCompare(b.clave));
}

/**
 * El texto del conocimiento que va al prompt. **Entra COMPLETO**: nada de búsqueda ni
 * embeddings (decisión cerrada). Se redacta descriptivo, no como pares
 * pregunta→respuesta — con pares, un carácter distinto rompía la coincidencia.
 *
 * ⚠️ El orden es ESTABLE (por `orden`, luego por clave) a propósito. El caché de prompt
 * es una coincidencia de prefijo byte a byte: si dos corridas ordenaran distinto, el
 * prefijo cambiaría y **el caché no entraría nunca**, sin ningún aviso.
 */
export function textoConocimiento(bloques: BloqueConocimiento[]): string {
  const usables = ordenar(bloques).filter((b) => !estaVacio(b));
  if (usables.length === 0) return '';
  return usables
    .map((b) => `## ${b.titulo}\n${b.contenido.trim()}`)
    .join('\n\n');
}

/**
 * Las claves de los bloques que el cliente aún no ha rellenado.
 * Es lo que se inyecta en las reglas, en vez de escribirlo a mano.
 */
export function clavesPendientes(bloques: BloqueConocimiento[]): string[] {
  return ordenar(bloques)
    .filter((b) => estaVacio(b) || estaPendiente(b))
    .map((b) => b.clave);
}

/**
 * La frase que se añade a las reglas de negocio con los pendientes de ESTE cliente,
 * calculada de su conocimiento. Cadena vacía si no hay ninguno — y entonces no se añade
 * nada, que es justo lo que evita el fallo de Peters Tours: sin pendientes, el agente no
 * recibe ninguna instrucción de escalar por falta de datos.
 */
export function avisoDePendientes(bloques: BloqueConocimiento[]): string {
  const titulos = ordenar(bloques)
    .filter((b) => estaVacio(b) || estaPendiente(b))
    .map((b) => b.titulo.toLowerCase());
  if (titulos.length === 0) return '';

  const lista =
    titulos.length === 1
      ? titulos[0]
      : `${titulos.slice(0, -1).join(', ')} y ${titulos[titulos.length - 1]}`;

  return (
    `BLOQUES SIN INFORMACIÓN TODAVÍA\n` +
    `Hoy no tienes datos de: ${lista}. Si te preguntan por eso, usa escalar_a_humano ` +
    `en vez de improvisar. Esta lista se calcula sola del conocimiento: no la memorices.`
  );
}

/**
 * Ensambla el sistema completo, EN ORDEN. Este orden no es estético:
 *
 *   1. perfil_agente   ─┐ lo ESTABLE va primero, y hasta aquí llega el caché
 *   2. CONOCIMIENTO    ─┘
 *   3. reglas_negocio + los pendientes calculados
 *
 * Lo que cambia en cada llamada —el historial— va después, en `messages`. Si el
 * conocimiento fuera detrás de algo variable, el prefijo cambiaría en cada corrida y el
 * caché no serviría de nada.
 */
export function ensamblarSistema(opciones: {
  perfilAgente: string;
  bloques: BloqueConocimiento[];
  reglasNegocio: string;
}): { perfil: string; conocimiento: string; reglas: string; caracteresCacheados: number } {
  const conocimiento = textoConocimiento(opciones.bloques);
  const aviso = avisoDePendientes(opciones.bloques);

  const perfil = opciones.perfilAgente.trim();
  const reglas = [opciones.reglasNegocio.trim(), aviso].filter(Boolean).join('\n\n');

  return {
    perfil,
    conocimiento: conocimiento ? `CONOCIMIENTO DEL NEGOCIO\n\n${conocimiento}` : '',
    reglas,
    // Lo que de verdad se cachea: perfil + conocimiento. Las reglas van detrás del
    // último punto de caché porque llevan los pendientes, que sí cambian al editarlos.
    caracteresCacheados: perfil.length + conocimiento.length,
  };
}
