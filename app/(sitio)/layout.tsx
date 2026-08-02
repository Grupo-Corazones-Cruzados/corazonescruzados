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
import CabeceraSitio from '@/components/sitio/CabeceraSitio';
import PieSitio from '@/components/sitio/PieSitio';

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
