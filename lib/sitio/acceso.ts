/**
 * EL ACCESO DESDE LA URL — `?acceso=` y `?redirect=`.
 *
 * ── HISTORIA ───────────────────────────────────────────────────────────────────
 * Del 2026-08-17 al 2026-10-26 hubo un botón «Plataforma» en la barra de navegación, y este
 * archivo tenía su `abrirPlataforma()`. Fernando lo devolvió al héroe de la portada como
 * «Progreso» (2026-10-26), junto a «Aventura»; allí abre el diálogo directamente. Lo que
 * queda aquí son las puertas por URL: `/auth`, el guardián del panel, correos y marcadores.
 *
 * ── LA REGLA QUE MANDA AQUÍ, Y NO ES NUEVA ─────────────────────────────────────
 * **El formulario de acceso es UNO SOLO: el de la portada.** Está escrito en
 * `app/page.tsx` —`EntryChoiceModal` y los diálogos que abre— y ya se decidió el
 * 2026-08-03, cuando `/auth/cliente` y sus hermanas eran páginas con un formulario propio
 * que *se parecía* al de la portada. Fernando lo vio en el acto. Desde entonces esas rutas
 * no son páginas: son **puertas con nombre** que redirigen a la portada para que abra el
 * diálogo que ya existe.
 *
 * ⚠️ **El acceso se abre EN LA PORTADA, no encima de la página en la que estabas.** Si algún
 * día tiene que abrirse *encima* de la página actual, hay que **extraer** toda la
 * orquestación de diálogos de `app/page.tsx` a un componente compartido y montarlo también
 * en `app/(sitio)/layout.tsx` — no copiarla, que es justo lo que la regla de arriba prohíbe.
 */

/** El valor de `?acceso=` que abre el menú «¿Cómo quieres ingresar?» hacia el panel. */
export const ACCESO_PLATAFORMA = 'plataforma';

/**
 * El valor de `?acceso=` que abre el acceso **con el juego como destino** (2026-08-19).
 *
 * Nació con los botones «IR» del panel izquierdo de `/clientes`: desde la tarjeta de
 * Videojuego, entrar tiene que acabar en la aventura, no en el panel. `?acceso=cliente` ya
 * existía pero manda al `dashboard` a propósito —es lo que separa «entrar a trabajar» de
 * «entrar a jugar»—, así que hacía falta un valor propio.
 *
 * ⚠️ **No abre un formulario nuevo**: abre el mismo diálogo de acceso de cliente de la
 * portada, solo que con `entryDestination = 'game'`. La regla de este archivo sigue en pie —
 * el acceso es UNO SOLO.
 */
export const ACCESO_VIDEOJUEGO = 'videojuego';

/**
 * ⭐ A DÓNDE SE PUEDE VOLVER TRAS INICIAR SESIÓN — definición única (2026-08-23).
 *
 * `?redirect=` existe **para una sola cosa**: el guardián del panel (`middleware.ts`) manda
 * a la portada a quien intenta entrar a `/dashboard/...` sin sesión, y al iniciarla hay que
 * devolverlo a donde iba. Siempre es una ruta **de dentro de la plataforma**.
 *
 * ── EL FALLO QUE ESTO CIERRA (Fernando, 2026-08-23) ────────────────────────────
 * El botón «Plataforma» de la barra mandaba la página en la que estabas como `?redirect=`.
 * Resultado: desde `/desarrollo-humano/ser-miembro` pulsabas «Plataforma», iniciabas sesión
 * como miembro… **y volvías a `/desarrollo-humano/ser-miembro`**, que es exactamente lo
 * contrario de lo que pide ese botón. El destino de «Plataforma» es la plataforma.
 *
 * Se comprueba aquí y no en cada pantalla porque el valor entra por la URL: cualquiera puede
 * escribir `/?acceso=plataforma&redirect=/lo-que-sea` y sacar a alguien de la plataforma
 * justo después de identificarse.
 */
// `/enlace`: un enlace de un solo uso atado a un cliente pide iniciar sesión y luego vuelve a
// él (Herramientas → Gestión, 2026-10-16).
const DESTINOS_PERMITIDOS = ['/dashboard', '/juego', '/enlace', '/entrega'];

export function destinoTrasAccesoValido(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  // Solo rutas internas: `//otro.host` y `https://…` son enlaces a otro sitio disfrazados.
  if (!ruta.startsWith('/') || ruta.startsWith('//')) return null;
  const base = ruta.split(/[?#]/)[0];
  return DESTINOS_PERMITIDOS.some((d) => base === d || base.startsWith(`${d}/`)) ? ruta : null;
}

