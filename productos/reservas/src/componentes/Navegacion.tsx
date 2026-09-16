'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { LogoHotel } from '@/componentes/Marca';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';

const PRINCIPAL = [
  { ruta: 'panel', etiqueta: 'Panel', icono: LayoutDashboard },
  { ruta: 'agenda', etiqueta: 'Agenda', icono: CalendarDays },
  { ruta: 'reportes', etiqueta: 'Reportes', icono: BarChart3 },
];

const ADMINISTRACION = [
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings },
];

const ROL_ETIQUETA: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CONSULTA: 'Consulta',
};

type Props = {
  slug: string;
  hotel: string;
  logoUrl: string | null;
  usuario: string;
  rol: RolUsuario;
};

/** Barra lateral (escritorio). En móvil se convierte en la barra inferior. */
export function BarraLateral({ slug, hotel, logoUrl, usuario, rol }: Props) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  /**
   * EL MENÚ SE CONTRAE A LOS ICONOS Y SE DESPLIEGA AL PASAR EL PUNTERO (Fernando,
   * 2026-09-16: «como ya lo hacemos en la app principal»). Mismo mecanismo que el raíl
   * de GCC World: se monta ENCIMA del contenido —el main conserva siempre el margen
   * del raíl estrecho— y cada fila mide lo mismo abierto o cerrado, así lo que está
   * bajo el puntero no se escapa al desplegarse. En táctil no hay puntero: ahí manda
   * la barra inferior, que ya existía.
   */
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const colapsado = !sobreElMenu;
  const esAdmin = rol === 'ADMIN';

  const Enlace = ({ item }: { item: (typeof PRINCIPAL)[number] }) => {
    const href = `/${slug}/${item.ruta}`;
    const activo = ruta.startsWith(href);
    return (
      <Link
        href={href}
        title={colapsado ? item.etiqueta : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-md h-9 text-[13px] transition-colors foco-visible',
          colapsado ? 'justify-center px-0' : 'px-3',
          activo
            ? 'bg-acento-suave font-semibold text-acento border-l-2 border-acento'
            : 'border-l-2 border-transparent text-texto hover:bg-realce',
        )}
      >
        <item.icono className={cn('h-[18px] w-[18px] shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        {!colapsado && <span className="truncate">{item.etiqueta}</span>}
      </Link>
    );
  };

  return (
    <>
      {/* Velo sobre el contenido mientras el menú está desplegado: el menú se monta
          ENCIMA del contenido (el main conserva el margen del raíl estrecho), no lo empuja. */}
      <div aria-hidden className={cn('hidden lg:block fixed inset-0 z-30 bg-black/45 pointer-events-none transition-opacity duration-200 print:hidden', sobreElMenu ? 'opacity-100' : 'opacity-0')} />
      <aside
        onMouseEnter={() => setSobreElMenu(true)}
        onMouseLeave={() => setSobreElMenu(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-borde bg-tarjeta lg:flex transition-[width] duration-200',
          colapsado ? 'w-16' : 'w-60 shadow-2xl',
        )}
      >
      <div className={cn('flex h-[68px] items-center gap-3 border-b border-borde', colapsado ? 'justify-center px-0' : 'px-4')}>
        <LogoHotel nombre={hotel} logoUrl={logoUrl} tamano={36} />
        {!colapsado && <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{hotel}</p>
          <p className="text-[10px] text-tenue">Gestión de Reservas</p>
        </div>}
      </div>

      <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
        <div className="h-7 flex items-center">
          {!colapsado && <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">Principal</p>}
        </div>
        {PRINCIPAL.map((i) => (
          <Enlace key={i.ruta} item={i} />
        ))}

        {esAdmin && (
          <>
            <div className="mt-2 h-7 flex items-center">
              {colapsado ? <span className="mx-2 h-px w-full bg-borde" /> : <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">Administración</p>}
            </div>
            {ADMINISTRACION.map((i) => (
              <Enlace key={i.ruta} item={i} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-borde p-3">
        <div className={cn('mb-2 flex h-8 items-center gap-2.5', colapsado ? 'justify-center' : 'px-1')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[12px] font-bold text-acento">
            {usuario.charAt(0).toUpperCase()}
          </div>
          {!colapsado && <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
            <p className="text-[10px] text-tenue">{ROL_ETIQUETA[rol]}</p>
          </div>}
        </div>
        <button
          onClick={() => arranca(() => salir(slug) as unknown as void)}
          disabled={saliendo}
          title={colapsado ? 'Cerrar sesión' : undefined}
          className={cn('flex h-9 w-full items-center gap-2 rounded-md text-[13px] text-error transition-colors hover:bg-error-suave foco-visible', colapsado ? 'justify-center px-0' : 'px-3')}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!colapsado && (saliendo ? 'Saliendo…' : 'Cerrar sesión')}
        </button>
      </div>
    </aside>
    </>
  );
}

/** Barra inferior (móvil). Mismos destinos: la navegación no cambia con el ancho. */
export function BarraInferior({ slug, rol }: Pick<Props, 'slug' | 'rol'>) {
  const ruta = usePathname();
  const [, arranca] = useTransition();
  const destinos = rol === 'ADMIN' ? [...PRINCIPAL, ...ADMINISTRACION] : PRINCIPAL;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-tarjeta lg:hidden">
      <div className="flex h-16 items-center justify-around">
        {destinos.map((i) => {
          const href = `/${slug}/${i.ruta}`;
          const activo = ruta.startsWith(href);
          return (
            <Link
              key={i.ruta}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors',
                activo ? 'text-acento' : 'text-tenue',
              )}
            >
              <i.icono className="h-5 w-5" />
              <span className="truncate">{i.etiqueta}</span>
            </Link>
          );
        })}
        <button
          onClick={() => arranca(() => salir(slug) as unknown as void)}
          className="flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] text-tenue"
        >
          <LogOut className="h-5 w-5" />
          <span>Salir</span>
        </button>
      </div>
    </nav>
  );
}

/** Cabecera de página: título a la izquierda, acciones a la derecha. */
export function CabeceraPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-3.5 sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold text-texto">{titulo}</h1>
        {descripcion && <p className="text-[12px] text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export const IconoUbicacion = Building2;
