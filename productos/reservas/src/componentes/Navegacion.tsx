'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
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
  const esAdmin = rol === 'ADMIN';

  const Enlace = ({ item }: { item: (typeof PRINCIPAL)[number] }) => {
    const href = `/${slug}/${item.ruta}`;
    const activo = ruta.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors foco-visible',
          activo
            ? 'bg-acento-suave font-semibold text-acento border-l-2 border-acento'
            : 'border-l-2 border-transparent text-texto hover:bg-realce',
        )}
      >
        <item.icono className={cn('h-[18px] w-[18px] shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        {item.etiqueta}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-borde bg-tarjeta lg:flex">
      <div className="flex items-center gap-3 border-b border-borde px-4 py-4">
        <LogoHotel nombre={hotel} logoUrl={logoUrl} tamano={36} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{hotel}</p>
          <p className="text-[10px] text-tenue">Gestión de Reservas</p>
        </div>
      </div>

      <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-tenue">
          Principal
        </p>
        {PRINCIPAL.map((i) => (
          <Enlace key={i.ruta} item={i} />
        ))}

        {esAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Administración
            </p>
            {ADMINISTRACION.map((i) => (
              <Enlace key={i.ruta} item={i} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-borde p-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[12px] font-bold text-acento">
            {usuario.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
            <p className="text-[10px] text-tenue">{ROL_ETIQUETA[rol]}</p>
          </div>
        </div>
        <button
          onClick={() => arranca(() => salir(slug) as unknown as void)}
          disabled={saliendo}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-error transition-colors hover:bg-error-suave foco-visible"
        >
          <LogOut className="h-4 w-4" />
          {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    </aside>
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
