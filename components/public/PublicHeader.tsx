'use client';

import Link from 'next/link';

/**
 * Header de marca para las páginas públicas (enlaces compartidos desde el dashboard). Va dentro
 * de `MarcoPublico`: la barra translúcida de las tarjetas del panel, con el tema del visitante.
 * Solo el logo + "GCC World" al extremo izquierdo (no se alinea al ancho del contenido);
 * al hacer clic lleva al inicio de la plataforma.
 */
export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--tarjeta-borde,var(--color-digi-border))] bg-[var(--tarjeta-fondo,var(--color-digi-card))] backdrop-blur-md">
      <div className="flex items-center px-4 md:px-6 h-14">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 group" title="Ir a GCC World">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="GCC World" className="w-8 h-8 rounded-full shrink-0" />
          <span
            className="text-[15px] font-semibold text-digi-text group-hover:text-accent transition-colors truncate"
            style={{ fontFamily: 'var(--font-titulo, var(--font-display))' }}
          >
            GCC World
          </span>
        </Link>
      </div>
    </header>
  );
}
