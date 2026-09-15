'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  Apple,
  ChefHat,
  Tag,
  ShieldAlert,
  Route,
  Bike,
  CalendarOff,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  UtensilsCrossed,
  UserRound,
  MapPin,
  CalendarX2,
} from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { LogoNegocio } from '@/componentes/Marca';
import { puede, ETIQUETA_ROL, type Capacidad } from '@/lib/permisos';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';

type Destino = {
  ruta: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  necesita: Capacidad;
  grupo: string;
};

/**
 * El menú del personal se arma por CAPACIDAD, no por rango: a quien está en la
 * cocina no le sobra «Clientes» porque tenga menos permisos, le sobra porque no
 * es su trabajo. Y así, quien entra ve solo su puesto.
 */
const DESTINOS: Destino[] = [
  { ruta: 'panel', etiqueta: 'Panel', icono: LayoutDashboard, necesita: 'ver', grupo: 'Principal' },
  { ruta: 'clientes', etiqueta: 'Clientes', icono: Users, necesita: 'clientes', grupo: 'Clientes' },
  { ruta: 'servicios', etiqueta: 'Servicios', icono: Package, necesita: 'servicios', grupo: 'Clientes' },
  { ruta: 'menus', etiqueta: 'Menús', icono: ChefHat, necesita: 'cocina', grupo: 'Cocina' },
  { ruta: 'etiquetas', etiqueta: 'Etiquetas', icono: Tag, necesita: 'cocina', grupo: 'Cocina' },
  { ruta: 'restricciones', etiqueta: 'Restricciones', icono: ShieldAlert, necesita: 'cocina', grupo: 'Cocina' },
  { ruta: 'alimentos', etiqueta: 'Alimentos', icono: Apple, necesita: 'cocina', grupo: 'Cocina' },
  { ruta: 'rutas', etiqueta: 'Rutas', icono: Route, necesita: 'despacho', grupo: 'Despacho' },
  { ruta: 'motorizados', etiqueta: 'Motorizados', icono: Bike, necesita: 'despacho', grupo: 'Despacho' },
  { ruta: 'reportes', etiqueta: 'Reportes', icono: BarChart3, necesita: 'reportes', grupo: 'Administración' },
  { ruta: 'feriados', etiqueta: 'Feriados', icono: CalendarOff, necesita: 'administrar', grupo: 'Administración' },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: UserCog, necesita: 'administrar', grupo: 'Administración' },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, necesita: 'administrar', grupo: 'Administración' },
];

/** El portal del cliente final: cuatro pantallas, sin permisos que filtrar. */
const DESTINOS_CLIENTE: Destino[] = [
  { ruta: 'mi-servicio', etiqueta: 'Mi servicio', icono: UtensilsCrossed, necesita: 'ver', grupo: 'Mi cuenta' },
  { ruta: 'cancelaciones', etiqueta: 'Cancelaciones', icono: CalendarX2, necesita: 'ver', grupo: 'Mi cuenta' },
  { ruta: 'mi-direccion', etiqueta: 'Mi dirección', icono: MapPin, necesita: 'ver', grupo: 'Mi cuenta' },
  { ruta: 'mi-perfil', etiqueta: 'Mi perfil', icono: UserRound, necesita: 'ver', grupo: 'Mi cuenta' },
];

type Quien = { tipo: 'personal'; rol: RolUsuario } | { tipo: 'cliente' };

const destinosDe = (q: Quien) =>
  q.tipo === 'cliente' ? DESTINOS_CLIENTE : DESTINOS.filter((d) => puede(q.rol, d.necesita));

const agrupar = (ds: Destino[]) => {
  const grupos: { titulo: string; destinos: Destino[] }[] = [];
  for (const d of ds) {
    const g = grupos.find((x) => x.titulo === d.grupo);
    if (g) g.destinos.push(d);
    else grupos.push({ titulo: d.grupo, destinos: [d] });
  }
  return grupos;
};

type Props = {
  slug: string;
  negocio: string;
  logoUrl: string | null;
  usuario: string;
  quien: Quien;
};

export function BarraLateral({ slug, negocio, logoUrl, usuario, quien }: Props) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const grupos = agrupar(destinosDe(quien));

  const Enlace = ({ d }: { d: Destino }) => {
    const href = `/${slug}/${d.ruta}`;
    const activo = ruta === href || ruta.startsWith(`${href}/`);
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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-borde bg-tarjeta lg:flex print:hidden">
      <div className="flex items-center gap-3 border-b border-borde px-4 py-4">
        <LogoNegocio nombre={negocio} logoUrl={logoUrl} tamano={36} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{negocio}</p>
          <p className="text-[10px] text-tenue">Gestión de Catering</p>
        </div>
      </div>

      <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
        {grupos.map((g, i) => (
          <div key={g.titulo}>
            <p className={cn('px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-tenue', i === 0 ? 'pt-2' : 'pt-4')}>
              {g.titulo}
            </p>
            {g.destinos.map((d) => (
              <Enlace key={d.ruta} d={d} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-borde p-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[12px] font-bold text-acento">
            {usuario.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
            <p className="text-[10px] text-tenue">{quien.tipo === 'cliente' ? 'Cliente' : ETIQUETA_ROL[quien.rol]}</p>
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
 * Barra inferior para el teléfono. Un cliente cancela su almuerzo desde el móvil
 * a las 6 de la mañana; un motorizado mira su ruta en la calle.
 */
export function BarraInferior({ slug, quien }: Pick<Props, 'slug' | 'quien'>) {
  const ruta = usePathname();
  const [, arranca] = useTransition();
  // Como mucho cinco: más iconos en una fila de móvil dejan de poder pulsarse.
  const destinos = destinosDe(quien).slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-tarjeta lg:hidden print:hidden">
      <div className="flex h-16 items-center justify-around">
        {destinos.map((d) => {
          const href = `/${slug}/${d.ruta}`;
          const activo = ruta === href || ruta.startsWith(`${href}/`);
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-3.5 sm:px-6 print:hidden">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold text-texto">{titulo}</h1>
        {descripcion && <p className="text-[12px] text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
