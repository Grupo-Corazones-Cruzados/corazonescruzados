'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import Mapa4P, { type SistemaMapa } from '@/components/centralized/Mapa4P';

const mf = { fontFamily: 'var(--font-body)' } as const;
const PORTADA = '/dashboard/centralized';

/**
 * LA NAVEGACIÓN DE CENTRALIZADO EN LAS APPS. El icono de tabla de la cabecera (`CabeceraMovil`) abre
 * el MAPA 4P: los sistemas de la cuenta en su celda piso × paso.
 *
 * Es un CAJÓN COMO EL DE PROGRESO (Fernando, 2026-11-08: «que no ocupe toda la pantalla… que tenga
 * overlay… y arriba el logo y el nombre de la app»): el mismo raíl, la misma marca (logo girando y
 * «GCC WORLD», que vuelve a Accesos), el mismo velo que lo cierra al tocarlo y la misma entrada de
 * 200 ms. Más ancho que los 224 px de Progreso porque la tabla tiene cinco columnas, pero nunca más
 * del 86 % de la pantalla: siempre queda velo a la vista para cerrarlo. Abajo, fija, la vuelta a la
 * portada de Centralizado (su dashboard): así no hace falta un botón de «atrás».
 */
export default function MenuCentralizado() {
  const pathname = usePathname();
  const { abierto, cerrar } = useMenuMovil();
  const [sistemas, setSistemas] = useState<SistemaMapa[] | null>(null);

  // Se piden al abrirlo por primera vez, no al cargar: casi siempre se navega sin abrirlo.
  useEffect(() => {
    if (!abierto || sistemas !== null) return;
    fetch('/api/centralized/systems')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setSistemas(j.data ?? []))
      .catch(() => setSistemas([]));
  }, [abierto, sistemas]);
  // Al llegar a otra página el cajón se cierra, como el de Progreso.
  useEffect(() => { cerrar(); }, [pathname, cerrar]);

  const enPortada = pathname === PORTADA;

  return (
    <>
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ease-out ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside aria-hidden={!abierto} inert={!abierto} aria-label="Mapa 4P"
        className={`rail fixed top-0 left-0 z-50 h-full w-[min(86vw,340px)] pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] bg-digi-card border-r border-digi-border flex flex-col transition-[translate] duration-200 ease-out motion-reduce:transition-none ${
          abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
        <Link href="/dashboard/accesos" className="flex items-center gap-2.5 h-14 px-4 border-b border-digi-border hover:bg-white/[0.05] transition-colors shrink-0">
          <Image src="/logo-gcc.png" alt="" width={30} height={30}
            className="rounded-full select-none shrink-0 motion-reduce:animate-none"
            style={{ animation: 'slowSpin 12s linear infinite reverse' }} />
          <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>GCC WORLD</span>
        </Link>

        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3">
          <div className="h-7 flex items-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted/70 px-1 truncate" style={mf}>Modelo 4P</p>
          </div>
          <Mapa4P sistemas={sistemas} rutaActual={pathname} />
        </div>

        <div className="shrink-0 border-t border-digi-border p-2">
          <Link href={PORTADA} onClick={cerrar}
            className={`relative flex items-center gap-2.5 rounded-md h-10 pl-2.5 text-[13px] font-medium transition-colors ${
              enPortada ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-white/[0.06]'}`}
            style={mf}>
            {enPortada && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
            <LayoutDashboard className={`w-[18px] h-[18px] shrink-0 ${enPortada ? 'text-accent' : ''}`} strokeWidth={2} />
            <span className="truncate">Inicio de Centralizado</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
