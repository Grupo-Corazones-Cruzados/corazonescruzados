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
 * Abre el acceso a la plataforma. Se llama desde el botón de la barra de navegación.
 *
 * @param destino Ruta a la que volver tras iniciar sesión. Se pasa como `?redirect=`, que
 *   es el parámetro que la portada ya sabe leer y conservar.
 */
export function abrirPlataforma(destino?: string) {
  if (typeof window === 'undefined') return;

  if (window.location.pathname === '/') {
    window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_PLATAFORMA));
    return;
  }

  const q = new URLSearchParams({ acceso: ACCESO_PLATAFORMA });
  // Volver a donde estaba tiene sentido para una página del sitio, no para el propio
  // acceso: `destino` solo se manda si nos lo dan explícitamente.
  if (destino?.startsWith('/')) q.set('redirect', destino);
  window.location.href = `/?${q.toString()}`;
}
