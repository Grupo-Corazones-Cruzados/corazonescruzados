/**
 * MARCO DEL SITIO PÚBLICO — cabecera y pie compartidos por `/soluciones`, `/desarrollo-humano` y
 * `/contacto`.
 *
 * La portada (`app/page.tsx`) NO está aquí a propósito: es una experiencia a pantalla
 * completa con su propio fondo y su propio ritmo, y monta la cabecera en modo flotante por
 * su cuenta. Meterla en este marco le pondría un pie corporativo debajo del pixel art.
 *
 * ── EL CUERPO ES CLARO; LA CABECERA Y EL PIE SIGUEN OSCUROS (2026-08-17) ───────
 * Fernando: *«la cabecera y el pie de páginas se quedan igual, solo cambia de tema el
 * contenido de las páginas»*. Aplica a las CINCO que cuelgan de aquí: Soluciones,
 * Desarrollo Humano, Contacto y los dos documentos legales.
 *
 * Que el tema claro viva **en el `<main>`** y no en este `<div>` es lo que hace que salga
 * gratis: `CabeceraSitio` y `PieSitio` son los mismos componentes que usa la portada, y no
 * hay que darles una variante ni arriesgarse a despeinar el pixel art. La franja oscura de
 * arriba y la de abajo enmarcan el papel.
 *
 * Colores LITERALES —vía la clase `claro-publico`, en `app/globals.css`—, no tokens del
 * tema: estas páginas se sirven a terceros —clientes, buscadores, revisores— y deben verse
 * igual pase lo que pase con el tema del panel de quien tenga sesión abierta.
 */

import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import CabeceraSitio from '@/components/sitio/CabeceraSitio';
import PieSitio from '@/components/sitio/PieSitio';
import TransicionSeccion from '@/components/sitio/TransicionSeccion';

/**
 * AQUÍ SÍ SE PUEDE AMPLIAR CON LOS DEDOS.
 *
 * La raíz bloquea el zoom porque el juego lo necesita. Estas son páginas de LEER, y
 * bloquear el pellizco en una página de leer deja fuera a quien necesita agrandar el texto.
 * Es un fallo de accesibilidad que además pesa: Google evalúa el sitio por su versión móvil.
 *
 * Sobrescribe el `viewport` de `app/layout.tsx` solo para `/soluciones`, `/desarrollo-humano`,
 * `/contacto` y los legales.
 */
/**
 * ⚠️ HAY QUE ANULAR **CAMPO POR CAMPO**, y esto costó un despliegue.
 *
 * La primera versión solo ponía `width` e `initialScale`, dando por hecho que lo que no se
 * declara aquí «no se hereda». Es al revés: Next **fusiona** el viewport con el de la raíz,
 * así que `maximumScale: 1` y `userScalable: false` seguían llegando y el zoom seguía
 * bloqueado. Se vio midiendo el `<meta>` en producción, no en el código.
 *
 * Por eso los dos campos están escritos **explícitamente**: es la única forma de deshacer
 * lo que pone la raíz.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function SitioLayout({ children }: { children: ReactNode }) {
  return (
    // ── EL PIE, SIEMPRE ABAJO ────────────────────────────────────────────────────
    // `min-h-screen` por sí solo NO basta, y es un malentendido habitual: estira el
    // envoltorio a la altura de la pantalla, pero sus hijos siguen apilándose uno tras otro,
    // así que en una página corta —`/soluciones`, sin ninguna puerta abierta— el pie quedaba
    // pegado al final del contenido y debajo sobraba un vacío. Lo vio Fernando.
    //
    // Se arregla con `flex flex-col` aquí y `flex-1` en el `<main>`: el cuerpo se queda con
    // todo el espacio que sobre y empuja el pie al fondo. En una página larga no cambia
    // nada, porque entonces no sobra espacio que repartir.
    //
    // La cabecera es `position: fixed`, así que no entra en el reparto; el `pt-16` del
    // `<main>` es lo que compensa su alto.
    <div
      className="min-h-screen flex flex-col bg-[#0b0d14] antialiased"
      style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
    >
      <CabeceraSitio />
      {/* El tema claro empieza aquí y termina aquí: la cabecera de arriba y el pie de abajo
          se quedan sobre el `#0b0d14` del envoltorio.

          `TransicionSeccion` va DENTRO del `<main>` y no fuera: el fondo y el color de
          texto tienen que estar puestos antes de que el contenido entre, o la transición
          arrancaría sobre un fondo sin pintar. Y el `<main>` no se remonta al navegar —para
          eso está el `key` de dentro—, así que el papel no parpadea entre página y página. */}
      <main className="claro-publico flex-1 pt-16 bg-[var(--papel)] text-[var(--suave)]">
        <TransicionSeccion>{children}</TransicionSeccion>
      </main>
      <PieSitio />
    </div>
  );
}
