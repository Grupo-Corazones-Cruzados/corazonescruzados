/**
 * MARCO DEL SITIO PÚBLICO — cabecera y pie compartidos por `/negocio`, `/recursos` y
 * `/contacto`.
 *
 * La portada (`app/page.tsx`) NO está aquí a propósito: es una experiencia a pantalla
 * completa con su propio fondo y su propio ritmo, y monta la cabecera en modo flotante por
 * su cuenta. Meterla en este marco le pondría un pie corporativo debajo del pixel art.
 *
 * Fondo `#0b0d14` fijo, no el token del tema: estas páginas se sirven a terceros —clientes,
 * buscadores, revisores— y deben verse igual pase lo que pase con el tema del panel.
 */

import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import CabeceraSitio from '@/components/sitio/CabeceraSitio';
import PieSitio from '@/components/sitio/PieSitio';

/**
 * AQUÍ SÍ SE PUEDE AMPLIAR CON LOS DEDOS.
 *
 * La raíz bloquea el zoom porque el juego lo necesita. Estas son páginas de LEER, y
 * bloquear el pellizco en una página de leer deja fuera a quien necesita agrandar el texto.
 * Es un fallo de accesibilidad que además pesa: Google evalúa el sitio por su versión móvil.
 *
 * Sobrescribe el `viewport` de `app/layout.tsx` solo para `/negocio`, `/recursos`,
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
    <div className="min-h-screen bg-[#0b0d14] text-white/75 antialiased" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <CabeceraSitio />
      {/* pt-16 = el alto de la cabecera fija. */}
      <main className="pt-16">{children}</main>
      <PieSitio />
    </div>
  );
}
