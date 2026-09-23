'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  LayoutDashboard,
  MessagesSquare,
  Workflow,
  Users,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { LogoHotel } from '@/componentes/Marca';
import { cn } from '@/lib/utils';
import type { Rol, TipoAutomatizacion } from '@/generated/prisma/enums';

export const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CONSULTA: 'Consulta',
};

const ESCALA: Record<Rol, number> = { CONSULTA: 0, OPERADOR: 1, ADMIN: 2 };

type Destino = {
  ruta: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  minimo: Rol;
  /** De qué producto es. Sin él, la pantalla es transversal y se ve siempre. */
  producto?: TipoAutomatizacion;
};

const DESTINOS: Destino[] = [
  { ruta: 'panel', etiqueta: 'Panel', icono: LayoutDashboard, minimo: 'CONSULTA' },
  // Las conversaciones son del Agente de IA: quien no lo tiene contratado no ve la
  // sección. No un botón apagado — la sección no está.
  { ruta: 'conversaciones', etiqueta: 'Conversaciones', icono: MessagesSquare, minimo: 'CONSULTA', producto: 'AGENTE_IA' },
  { ruta: 'automatizaciones', etiqueta: 'Automatizaciones', icono: Workflow, minimo: 'CONSULTA' },
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: Users, minimo: 'ADMIN' },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, minimo: 'ADMIN' },
];

const visibles = (rol: Rol, abiertos: TipoAutomatizacion[]) =>
  DESTINOS.filter((d) => ESCALA[rol] >= ESCALA[d.minimo] && (!d.producto || abiertos.includes(d.producto)));

type Props = {
  slug: string;
  cliente: string;
  logoUrl: string | null;
  usuario: string;
  rol: Rol;
  /** Los productos que el cliente tiene al día. Deciden qué secciones existen. */
  abiertos: TipoAutomatizacion[];
};

/**
 * ── LA BARRA DE ABAJO ES LA DE TELÉFONO, Y NO ES UN RESPONSIVE ──────────────────
 * Fernando fijó el 2026-09-21 que cada pantalla tenga un diseño hecho para teléfono,
 * y desde el 2026-09-23 eso ya no es una cortesía: esta aplicación se va a empaquetar
 * y publicar en las tiendas. Por eso hay DOS navegaciones de verdad —una lateral de
 * escritorio y una barra inferior de teléfono— y no una sola que se encoge.
 *
 * Los destinos de la barra inferior se topan en cuatro: el quinto no cabe sin dejar
 * los toques por debajo de los 44 px que pide una pantalla táctil. Lo que no entra,
 * entra por «Configuración».
 */
export function BarraLateral({ slug, cliente, logoUrl, usuario, rol, abiertos }: Props) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const destinos = visibles(rol, abiertos);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-borde bg-tarjeta transition-[width] hover:w-56 lg:flex group">
      <div className="flex h-14 items-center gap-2.5 px-3">
        <LogoHotel nombre={cliente} logoUrl={logoUrl} tamano={34} />
        <span className="hidden whitespace-nowrap text-[13px] font-semibold text-texto group-hover:block">
          {cliente}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {destinos.map((d) => {
          const activo = ruta?.startsWith(`/${slug}/${d.ruta}`);
          const Icono = d.icono;
          return (
            <Link
              key={d.ruta}
              href={`/${slug}/${d.ruta}`}
              className={cn(
                'flex h-10 items-center gap-3 rounded px-2.5 text-[13px] transition-colors',
                activo ? 'bg-acento-suave text-acento' : 'text-tenue hover:bg-realce hover:text-texto',
              )}
            >
              <Icono className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden whitespace-nowrap group-hover:block">{d.etiqueta}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-borde px-2 py-2">
        <Link
          href={`/${slug}/suscripcion`}
          className="flex h-10 items-center gap-3 rounded px-2.5 text-[13px] text-tenue transition-colors hover:bg-realce hover:text-texto"
        >
          <CreditCard className="h-[18px] w-[18px] shrink-0" />
          <span className="hidden whitespace-nowrap group-hover:block">Suscripción</span>
        </Link>
        <div className="hidden px-2.5 pb-1 pt-2 group-hover:block">
          <p className="truncate text-[12px] font-medium text-texto">{usuario}</p>
          <p className="text-[11px] text-tenue">{ETIQUETA_ROL[rol]}</p>
        </div>
        <button
          type="button"
          onClick={() => arranca(() => salir(slug))}
          disabled={saliendo}
          className="flex h-10 w-full items-center gap-3 rounded px-2.5 text-[13px] text-tenue transition-colors hover:bg-realce hover:text-texto"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="hidden whitespace-nowrap group-hover:block">
            {saliendo ? 'Saliendo…' : 'Salir'}
          </span>
        </button>
      </div>
    </aside>
  );
}

export function BarraInferior({ slug, rol, abiertos }: { slug: string; rol: Rol; abiertos: TipoAutomatizacion[] }) {
  const ruta = usePathname();
  // Cuatro como mucho: cada destino necesita 44 px de ancho útil para un dedo, y en
  // una pantalla de 360 px el quinto los rompe.
  const destinos = visibles(rol, abiertos).slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borde bg-tarjeta lg:hidden">
      {destinos.map((d) => {
        const activo = ruta?.startsWith(`/${slug}/${d.ruta}`);
        const Icono = d.icono;
        return (
          <Link
            key={d.ruta}
            href={`/${slug}/${d.ruta}`}
            className={cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[10.5px]',
              activo ? 'text-acento' : 'text-tenue',
            )}
          >
            <Icono className="h-[22px] w-[22px]" />
            <span className="truncate">{d.etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}
