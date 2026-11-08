'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import Mapa4P, { type SistemaMapa } from '@/components/centralized/Mapa4P';

/**
 * LA NAVEGACIÓN DE CENTRALIZADO EN LAS APPS (Fernando, 2026-11-08). Dentro de un sistema, el botón de
 * la cabecera (`CabeceraMovil`) abre el MAPA 4P en vez de una lista: los sistemas de la cuenta en su
 * celda piso × paso. A Accesos solo se vuelve tocando el logo. En la portada de Centralizado el mapa
 * ya está en la página, así que el botón no aparece.
 */
export default function MenuCentralizado() {
  const pathname = usePathname();
  const { abierto, cerrar } = useMenuMovil();
  const [sistemas, setSistemas] = useState<SistemaMapa[] | null>(null);

  // Se piden al abrirlo por primera vez, no al cargar: en la portada la página ya los pide, y dos
  // peticiones a la vez a esa ruta se estorban.
  useEffect(() => {
    if (!abierto || sistemas !== null) return;
    fetch('/api/centralized/systems')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setSistemas(j.data ?? []))
      .catch(() => setSistemas([]));
  }, [abierto, sistemas]);
  useEffect(() => { cerrar(); }, [pathname, cerrar]);

  return (
    <>
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside aria-hidden={!abierto}
        className={`fixed top-0 left-0 z-50 h-full w-[min(100vw,440px)] pt-[calc(var(--seguro-arriba)+1rem)] pb-[var(--seguro-abajo)] px-3 bg-digi-dark border-r border-digi-border overflow-y-auto transition-[translate] duration-200 ease-out ${
          abierto ? 'translate-x-0 shadow-xl' : '-translate-x-full'}`}>
        <Mapa4P sistemas={sistemas} rutaActual={pathname} />
      </aside>
    </>
  );
}
