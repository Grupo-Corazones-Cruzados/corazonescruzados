'use client';

/**
 * LA CABECERA DEL TELÉFONO — el botón de menú y la marca.
 *
 * ── POR QUÉ NO ES FIJA (2026-09-02) ───────────────────────────────────────────────────
 * Empezó siendo un botón flotando en la esquina y pasó a ser una barra `fixed`. Las dos
 * cosas tenían el mismo defecto de fondo, y es el que Fernando señaló dos veces: **lo que
 * está pegado a la ventana siempre tiene contenido pasando por debajo**. Al bajar por una
 * página larga, la barra iba cortando por la mitad lo que hubiera detrás — un botón, una
 * fila de la tabla, la cabecera de un calendario.
 *
 * Así que deja de estar pegada: **ocupa su sitio en el flujo**, arriba del contenido. Nada
 * puede meterse debajo porque no hay «debajo»; empuja lo que viene después, como cualquier
 * otro bloque de la página. Al bajar se va con el resto y al subir vuelve.
 *
 * Es la misma decisión que ya se tomó con el menú de escritorio: **preferimos que las
 * cosas ocupen su sitio a que se lo roben a otro.**
 *
 * Solo en teléfono: en escritorio el menú lateral está siempre a la vista y esta barra
 * sobraría.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function CabeceraMovil() {
  const { abrir } = useMenuMovil();

  return (
    // `rail` para heredar los colores del menú: la cabecera y el menú que abre son la
    // misma cosa, y verlos del mismo color lo dice sin explicarlo.
    <header className="rail lg:hidden shrink-0 h-14 flex items-center gap-3 px-3 bg-digi-card border-b border-digi-border">
      <button
        onClick={abrir}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-digi-text transition-[filter] duration-150 hover:brightness-125"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <Link href="/" className="flex items-center gap-2 min-w-0">
        <Image
          src="/logo-gcc.png" alt="" width={26} height={26} priority
          className="rounded-full select-none shrink-0"
        />
        <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>
          GCC WORLD
        </span>
      </Link>
    </header>
  );
}
