'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { HERRAMIENTAS } from '@/lib/herramientas/catalogo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const BOTON = 'w-11 h-11 flex items-center justify-center rounded-lg text-digi-text transition-[filter] duration-150 hover:brightness-125 active:brightness-150';

/**
 * LA CABECERA DE LO QUE NO ES PROGRESO, dentro de las apps (Fernando, 2026-11-08: «el menú de
 * hamburguesa… no debería ser accesible hasta que elija Progreso»; «las herramientas deben tener su
 * propio acceso»; «Centralizado tampoco puede estar dentro de Progreso»). Accesos lleva la marca y
 * Salir, porque ahí no hay menú; una herramienta o Centralizado, la flecha que vuelve a Accesos.
 * Mismo aspecto que `CabeceraMovil`, sin el botón del menú. Ver `esSeccionDeApp` en el layout.
 */
export default function CabeceraSeccion() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [titulo, setTitulo] = useState('');
  const enAccesos = pathname.startsWith('/dashboard/accesos');

  useEffect(() => {
    if (pathname.startsWith('/dashboard/centralized')) return setTitulo('Centralizado');
    if (pathname.startsWith('/dashboard/tools')) {
      const id = new URLSearchParams(window.location.search).get('herramienta');
      return setTitulo(HERRAMIENTAS.find((h) => h.id === id)?.name ?? 'Herramientas');
    }
    setTitulo('');
  }, [pathname]);

  return (
    <header className="rail shrink-0 h-[calc(3.5rem+var(--seguro-arriba))] pt-[var(--seguro-arriba)] flex items-center gap-2 px-2 bg-digi-card border-b border-digi-border">
      {enAccesos ? (
        <span className="flex items-center gap-2 min-w-0 h-11 px-2">
          <Image src="/logo-gcc.png" alt="" width={30} height={30} priority className="rounded-full select-none shrink-0" />
          <span className="text-[15px] font-bold text-digi-text tracking-tight truncate" style={mf}>GCC WORLD</span>
        </span>
      ) : (
        <>
          <Link href="/dashboard/accesos" className={BOTON} aria-label="Volver a Accesos" title="Volver a Accesos">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="text-[15px] font-semibold text-digi-text truncate" style={mf}>{titulo}</span>
        </>
      )}
      {enAccesos && (
        <button onClick={signOut} className={`${BOTON} ml-auto`} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut className="w-5 h-5" />
        </button>
      )}
    </header>
  );
}
