'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import FichaUsuario from '@/components/dashboard/FichaUsuario';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';
import { MODULOS_PRODUCTO, rutaDelProducto } from '@/lib/productos/modulos';
import { PRODUCTOS } from '@/lib/productos/tipos';
import { iconoDeProducto } from '@/components/accesos/useAccesos';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * LA SEGUNDA CAPA DE UN PRODUCTO (Fernando, 2026-11-08: «los productos deben mostrar el menú de cada
 * producto como una capa adicional»). Al lado del raíl de Accesos, igual que el menú de Progreso: los
 * módulos del producto (`lib/productos/modulos.ts`). Elegir uno cambia lo que muestra el marco de la
 * página (`?m=`); el producto ya tiene la sesión abierta.
 */
export default function MenuProducto() {
  const router = useRouter();
  const { producto = '', slug = '' } = useParams<{ producto: string; slug: string }>();
  const modulo = useSearchParams().get('m') || 'panel';
  const { abierto, cerrar } = useMenuMovil();
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const telefono = useConsultaMedia('(max-width: 63.99rem)');
  const estrecho = !telefono && !sobreElMenu && !abierto;
  const nombre = PRODUCTOS.find((p) => p.clave === producto)?.nombre ?? producto;
  const modulos = MODULOS_PRODUCTO[producto] ?? [];

  useEffect(() => { cerrar(); }, [modulo, cerrar]);

  return (
    <>
      <div aria-hidden onClick={cerrar}
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-200 ease-out ${abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
      <aside onMouseEnter={() => setSobreElMenu(true)} onMouseLeave={() => setSobreElMenu(false)}
        className={`rail fixed top-0 left-16 h-full pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)] ${abierto ? 'z-50' : 'z-40'} bg-digi-card border-r border-digi-border flex flex-col transition-[width,translate] duration-200 ease-out
          ${estrecho ? 'w-16' : telefono ? 'w-56' : 'w-56 shadow-2xl'}
          ${abierto ? 'translate-x-0 shadow-xl' : '-translate-x-[calc(100%+4rem)] lg:translate-x-0'} menu-avanza`}>
        <div className={`flex items-center gap-2.5 h-14 border-b border-digi-border shrink-0 ${estrecho ? 'justify-center px-0' : 'px-4'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconoDeProducto(producto)} alt="" width={30} height={30} className="w-[30px] h-[30px] rounded-lg shrink-0" />
          {!estrecho && <span className="text-[13px] font-bold text-digi-text tracking-tight truncate uppercase" style={mf}>{nombre}</span>}
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={mf}>
          {modulos.map((m) => {
            const activo = m.ruta === modulo;
            return (
              <button key={m.ruta} type="button" title={estrecho ? m.etiqueta : undefined}
                onClick={() => router.replace(`${rutaDelProducto(producto, slug)}?m=${m.ruta}`, { scroll: false })}
                className={`relative flex items-center gap-2.5 rounded-md h-9 w-full text-[13px] font-medium transition-colors ${estrecho ? 'justify-center px-0' : 'px-2.5'} ${
                  activo ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-white/[0.06]'}`}>
                {activo && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                <m.Icono className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                {!estrecho && <span className="truncate">{m.etiqueta}</span>}
              </button>
            );
          })}
        </nav>
        <div className="shrink-0 p-2 border-t border-digi-border">
          <FichaUsuario estrecho={estrecho} />
        </div>
      </aside>
    </>
  );
}
