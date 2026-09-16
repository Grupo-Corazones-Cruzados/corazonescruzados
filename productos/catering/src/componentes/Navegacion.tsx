'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
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
  const grupos = agrupar(destinosDe(quien));

  const Enlace = ({ d }: { d: Destino }) => {
    const href = `/${slug}/${d.ruta}`;
    const activo = ruta === href || ruta.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        title={colapsado ? d.etiqueta : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-md h-9 text-[13px] transition-colors foco-visible',
          colapsado ? 'justify-center px-0' : 'px-3',
          activo
            ? 'bg-acento-suave font-semibold text-acento border-l-2 border-acento'
            : 'border-l-2 border-transparent text-texto hover:bg-realce',
        )}
      >
        <d.icono className={cn('h-[18px] w-[18px] shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        {!colapsado && <span className="truncate">{d.etiqueta}</span>}
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
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-borde bg-tarjeta lg:flex transition-[width] duration-200 print:hidden',
          colapsado ? 'w-16' : 'w-60 shadow-2xl',
        )}
      >
      <div className={cn('flex h-[68px] items-center gap-3 border-b border-borde', colapsado ? 'justify-center px-0' : 'px-4')}>
        <LogoNegocio nombre={negocio} logoUrl={logoUrl} tamano={36} />
        {!colapsado && <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{negocio}</p>
          <p className="text-[10px] text-tenue">Gestión de Catering</p>
        </div>}
      </div>

      <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
        {grupos.map((g, i) => (
          <div key={g.titulo}>
            {/* Alto constante abierto o cerrado: los módulos no se mueven al desplegarse. */}
            <div className={cn('h-7 flex items-center', i > 0 && 'mt-2')}>
              {colapsado ? (i > 0 ? <span className="mx-2 h-px w-full bg-borde" /> : null) : <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">{g.titulo}</p>}
            </div>
            {g.destinos.map((d) => (
              <Enlace key={d.ruta} d={d} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-borde p-3">
        <div className={cn('mb-2 flex h-8 items-center gap-2.5', colapsado ? 'justify-center' : 'px-1')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[12px] font-bold text-acento">
            {usuario.charAt(0).toUpperCase()}
          </div>
          {!colapsado && <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
            <p className="text-[10px] text-tenue">{quien.tipo === 'cliente' ? 'Cliente' : ETIQUETA_ROL[quien.rol]}</p>
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
