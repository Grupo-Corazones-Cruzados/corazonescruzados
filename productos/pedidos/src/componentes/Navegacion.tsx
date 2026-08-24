'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  LayoutDashboard,
  ChefHat,
  CalendarClock,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { LogoHotel } from '@/componentes/Marca';
import { puede, ETIQUETA_ROL, type Capacidad } from '@/lib/permisos';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';

type Destino = {
  ruta: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  necesita: Capacidad;
  grupo: 'servicio' | 'administracion';
};

/**
 * El menú se arma por CAPACIDAD, no por rango: a un cocinero no le sobra «Cobros»
 * porque tenga menos permisos, le sobra porque no es su trabajo. Y así, quien entra
 * ve solo su puesto.
 */
const DESTINOS: Destino[] = [
  { ruta: 'panel', etiqueta: 'Mesas', icono: LayoutDashboard, necesita: 'ver', grupo: 'servicio' },
  { ruta: 'cocina', etiqueta: 'Cocina', icono: ChefHat, necesita: 'cocinar', grupo: 'servicio' },
  { ruta: 'reservas', etiqueta: 'Reservas', icono: CalendarClock, necesita: 'reservar-mesas', grupo: 'servicio' },
  { ruta: 'reportes', etiqueta: 'Reportes', icono: BarChart3, necesita: 'cobrar', grupo: 'servicio' },
  { ruta: 'catalogo', etiqueta: 'Carta', icono: BookOpen, necesita: 'administrar', grupo: 'administracion' },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: Users, necesita: 'administrar', grupo: 'administracion' },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, necesita: 'administrar', grupo: 'administracion' },
];

const paraRol = (rol: RolUsuario) => DESTINOS.filter((d) => puede(rol, d.necesita));

type Props = {
  slug: string;
  negocio: string;
  logoUrl: string | null;
  usuario: string;
  rol: RolUsuario;
};

export function BarraLateral({ slug, negocio, logoUrl, usuario, rol }: Props) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const míos = paraRol(rol);
  const servicio = míos.filter((d) => d.grupo === 'servicio');
  const administracion = míos.filter((d) => d.grupo === 'administracion');

  const Enlace = ({ d }: { d: Destino }) => {
    const href = `/${slug}/${d.ruta}`;
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
        <d.icono className={cn('h-[18px] w-[18px] shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        {d.etiqueta}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-borde bg-tarjeta lg:flex">
      <div className="flex items-center gap-3 border-b border-borde px-4 py-4">
        <LogoHotel nombre={negocio} logoUrl={logoUrl} tamano={36} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{negocio}</p>
          <p className="text-[10px] text-tenue">Gestión de Pedidos</p>
        </div>
      </div>

      <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-tenue">
          Servicio
        </p>
        {servicio.map((d) => (
          <Enlace key={d.ruta} d={d} />
        ))}
        {administracion.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Administración
            </p>
            {administracion.map((d) => (
              <Enlace key={d.ruta} d={d} />
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
            <p className="text-[10px] text-tenue">{ETIQUETA_ROL[rol]}</p>
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

/**
 * Barra inferior. En este producto NO es un adorno: un mesero trabaja con el
 * teléfono en la mano y no va a abrir un portátil entre mesa y mesa.
 */
export function BarraInferior({ slug, rol }: Pick<Props, 'slug' | 'rol'>) {
  const ruta = usePathname();
  const [, arranca] = useTransition();
  // Como mucho cinco: más iconos en una fila de móvil dejan de poder pulsarse.
  const destinos = paraRol(rol).slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-tarjeta lg:hidden">
      <div className="flex h-16 items-center justify-around">
        {destinos.map((d) => {
          const href = `/${slug}/${d.ruta}`;
          const activo = ruta.startsWith(href);
          return (
            <Link
              key={d.ruta}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors',
                activo ? 'text-acento' : 'text-tenue',
              )}
            >
              <d.icono className="h-5 w-5" />
              <span className="truncate">{d.etiqueta}</span>
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
