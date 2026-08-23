/**
 * ABRIR LA PLATAFORMA — un solo punto de entrada al acceso, desde donde sea.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ────────────────────────────────────────────────
 * El botón «Plataforma» dejó de estar en el héroe de la portada (Fernando, 2026-08-17) y
 * pasó a la barra de navegación, que se ve en TODAS las páginas. Así que ahora hay que
 * poder abrir el acceso desde `/soluciones`, desde `/legal` o desde donde esté el usuario,
 * y no solo desde la portada.
 *
 * ── LA REGLA QUE MANDA AQUÍ, Y NO ES NUEVA ─────────────────────────────────────
 * **El formulario de acceso es UNO SOLO: el de la portada.** Está escrito en
 * `app/page.tsx` —`EntryChoiceModal` y los diálogos que abre— y ya se decidió el
 * 2026-08-03, cuando `/auth/cliente` y sus hermanas eran páginas con un formulario propio
 * que *se parecía* al de la portada. Fernando lo vio en el acto. Desde entonces esas rutas
 * no son páginas: son **puertas con nombre** que redirigen a la portada para que abra el
 * diálogo que ya existe.
 *
 * Este archivo hace lo mismo para el botón de la barra. No escribe un segundo acceso.
 *
 * ── LOS DOS CAMINOS ────────────────────────────────────────────────────────────
 * · **Ya estamos en la portada** → se avisa con un evento y el diálogo se abre en el sitio,
 *   sin recargar. Recargar la portada volvería a lanzar su intro completa.
 * · **Estamos en cualquier otra página** → se va a `/auth`, que redirige a la portada con
 *   `?acceso=plataforma`, y allí se abre el mismo diálogo.
 *
 * ⚠️ **Esto significa que el acceso se abre EN LA PORTADA, no encima de la página en la que
 * estabas.** Es coherente con lo que ya hacían `/auth/cliente`, `/auth/miembro` y el
 * guardián del panel, que mandan ahí desde siempre. Si algún día tiene que abrirse *encima*
 * de la página actual, hay que **extraer** toda la orquestación de diálogos de
 * `app/page.tsx` a un componente compartido y montarlo también en `app/(sitio)/layout.tsx`
 * — no copiarla, que es justo lo que la regla de arriba prohíbe.
 */

/** El evento que escucha la portada para abrir el acceso sin recargarse. */
export const EVENTO_ABRIR_PLATAFORMA = 'gcc:abrir-plataforma';

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
const DESTINOS_PERMITIDOS = ['/dashboard', '/juego'];

export function destinoTrasAccesoValido(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  // Solo rutas internas: `//otro.host` y `https://…` son enlaces a otro sitio disfrazados.
  if (!ruta.startsWith('/') || ruta.startsWith('//')) return null;
  const base = ruta.split(/[?#]/)[0];
  return DESTINOS_PERMITIDOS.some((d) => base === d || base.startsWith(`${d}/`)) ? ruta : null;
}

/**
 * Abre el acceso a la plataforma. Se llama desde el botón de la barra de navegación.
 *
 * ⚠️ **No lleva destino.** Quien pulsa «Plataforma» quiere entrar a la plataforma; devolverlo
 * a la página del sitio en la que estaba es el fallo que se corrigió el 2026-08-23. El único
 * `?redirect=` legítimo lo pone el guardián del panel, y va a `/dashboard/...`.
 */
export function abrirPlataforma() {
  if (typeof window === 'undefined') return;

  if (window.location.pathname === '/') {
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PLATAFORMA));
    return;
  }

  window.location.href = `/?acceso=${ACCESO_PLATAFORMA}`;
}
