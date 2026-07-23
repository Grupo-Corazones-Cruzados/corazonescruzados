'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { BTN_SECONDARY } from '@/components/ui/Button';

/**
 * Header de marca para las páginas públicas (enlaces compartidos desde el dashboard).
 * Izquierda: logo + "GCC World" que lleva al inicio de la plataforma. Derecha: un slot
 * configurable (`right`); por defecto, un acceso para iniciar sesión.
 */
export default function PublicHeader({ right, maxWidth = 'max-w-6xl' }: { right?: React.ReactNode; maxWidth?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-digi-card border-b border-digi-border">
      <div className={`${maxWidth} mx-auto flex items-center justify-between gap-3 px-4 md:px-6 h-14`}>
        <Link href="/" className="flex items-center gap-2.5 min-w-0 group" title="Ir a GCC World">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="GCC World" className="w-8 h-8 rounded-full shrink-0" />
          <span
            className="text-[15px] font-semibold text-digi-text group-hover:text-accent transition-colors truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            GCC World
          </span>
        </Link>
        {right !== undefined ? right : (
          <a href="/?acceso=cliente" className={`${BTN_SECONDARY} shrink-0`}>
            <LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Iniciar sesión</span>
          </a>
        )}
      </div>
    </header>
  );
}
