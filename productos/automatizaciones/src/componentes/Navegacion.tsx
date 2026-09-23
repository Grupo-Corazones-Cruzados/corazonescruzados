'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
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

/**
 * LA NAVEGACIÓN, CALCADA DE «GESTIÓN DE RESERVAS» (Fernando, 2026-09-23: «aprende por
 * ejemplo del producto de gestión de reservas, ese producto está muy bien desarrollada su
 * navegación y módulos básicos»).
 *
 * No es «parecida»: es EL MISMO patrón, para que quien use dos productos del grupo no
 * tenga que aprender dos aplicaciones. Lo único que cambia son los destinos.
 *
 * ── LO QUE HACE ESTE MENÚ ────────────────────────────────────────────────────────
 * · Se CONTRAE a los iconos (64 px) y SE DESPLIEGA AL PASAR EL PUNTERO (240 px).
 * · Se monta ENCIMA del contenido —el `main` conserva siempre el margen del raíl
 *   estrecho—, con un velo oscuro detrás. Así el contenido no salta al desplegarse.
 * · CADA FILA MIDE LO MISMO abierta que cerrada, de modo que lo que está bajo el puntero
 *   no se escapa cuando el menú crece. Es el detalle que hace que no sea molesto.
 * · En táctil no hay puntero: ahí manda la BARRA INFERIOR, con los mismos destinos.
 *
 * ── QUIÉN VE QUÉ ─────────────────────────────────────────────────────────────────
 * El grupo ADMINISTRACIÓN —cuentas, configuración y suscripción— es SOLO DEL ADMIN.
 * Fernando lo pidió con nombre propio: «el administrador debe poder administrar las
 * cuentas que pueden acceder, pero solo el administrador debe tener acceso a ese módulo».
 * No basta con que las páginas lo comprueben (que lo hacen, en `exigirContexto(…, 'ADMIN')`):
 * es que NO SE ENSEÑAN, porque un enlace que lleva a una negativa es peor que no tenerlo.
 */

type Item = {
  ruta: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Otras rutas que marcan este destino como activo (se llega desde él). */
  tambien: string[];
  /**
   * Qué tipo de automatización lo hace útil. Sin él, el destino se ve siempre.
   * No es una puerta de pago —el producto se vende entero— sino de sentido: quien no
   * tiene ningún agente montado no tiene ninguna conversación que mirar.
   */
  tipo?: TipoAutomatizacion;
};

const PRINCIPAL: Item[] = [
  { ruta: 'panel', etiqueta: 'Panel', icono: LayoutDashboard, tambien: [] },
  { ruta: 'conversaciones', etiqueta: 'Conversaciones', icono: MessagesSquare, tambien: [], tipo: 'AGENTE_IA' },
  { ruta: 'automatizaciones', etiqueta: 'Automatizaciones', icono: Workflow, tambien: [] },
];

const ADMINISTRACION: Item[] = [
  { ruta: 'usuarios', etiqueta: 'Cuentas', icono: Users, tambien: [] },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, tambien: [] },
  { ruta: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard, tambien: [] },
];

const estaActivo = (ruta: string, slug: string, item: Item) =>
  [item.ruta, ...item.tambien].some((r) => ruta.startsWith(`/${slug}/${r}`));

const ROL_ETIQUETA: Record<Rol, string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
  CONSULTA: 'Consulta',
};

const utiles = (items: Item[], montados: TipoAutomatizacion[]) =>
  items.filter((i) => !i.tipo || montados.includes(i.tipo));

type Props = {
  slug: string;
  cliente: string;
  logoUrl: string | null;
  usuario: string;
  rol: Rol;
  /** Los tipos de automatización que el cliente tiene montados. */
  montados: TipoAutomatizacion[];
};

/** Barra lateral (escritorio). En móvil manda la barra inferior. */
export function BarraLateral({ slug, cliente, logoUrl, usuario, rol, montados }: Props) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const colapsado = !sobreElMenu;
  const esAdmin = rol === 'ADMIN';
  const principales = utiles(PRINCIPAL, montados);

  const Enlace = ({ item }: { item: Item }) => {
    const activo = estaActivo(ruta, slug, item);
    return (
      <Link
        href={`/${slug}/${item.ruta}`}
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
      {/* Velo sobre el contenido mientras el menú está desplegado: el menú se monta ENCIMA
          (el main conserva el margen del raíl estrecho), no lo empuja. */}
      <div
        aria-hidden
        className={cn(
          'hidden lg:block fixed inset-0 z-30 bg-black/45 pointer-events-none transition-opacity duration-200 print:hidden',
          sobreElMenu ? 'opacity-100' : 'opacity-0',
        )}
      />
      <aside
        onMouseEnter={() => setSobreElMenu(true)}
        onMouseLeave={() => setSobreElMenu(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-borde bg-tarjeta lg:flex transition-[width] duration-200',
          colapsado ? 'w-16' : 'w-60 shadow-2xl',
        )}
      >
        <div
          className={cn(
            'flex h-[68px] items-center gap-3 border-b border-borde',
            colapsado ? 'justify-center px-0' : 'px-4',
          )}
        >
          <LogoHotel nombre={cliente} logoUrl={logoUrl} tamano={36} />
          {!colapsado && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-texto">{cliente}</p>
              <p className="text-[10px] text-tenue">Automatizaciones</p>
            </div>
          )}
        </div>

        <nav className="desplaza flex-1 space-y-1 overflow-y-auto p-2">
          <div className="h-7 flex items-center">
            {!colapsado && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">Principal</p>
            )}
          </div>
          {principales.map((i) => (
            <Enlace key={i.ruta} item={i} />
          ))}

          {esAdmin && (
            <>
              <div className="mt-2 h-7 flex items-center">
                {colapsado ? (
                  <span className="mx-2 h-px w-full bg-borde" />
                ) : (
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-tenue">
                    Administración
                  </p>
                )}
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
            {!colapsado && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
                <p className="text-[10px] text-tenue">{ROL_ETIQUETA[rol]}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => arranca(() => salir(slug) as unknown as void)}
            disabled={saliendo}
            title={colapsado ? 'Cerrar sesión' : undefined}
            className={cn(
              'flex h-9 w-full items-center gap-2 rounded-md text-[13px] text-error transition-colors hover:bg-error-suave foco-visible',
              colapsado ? 'justify-center px-0' : 'px-3',
            )}
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
 * Barra inferior (móvil). Mismos destinos: la navegación no cambia con el ancho.
 *
 * ⚠️ Se topa en CINCO huecos contando «Salir»: cada uno necesita unos 44 px de ancho útil
 * para un dedo, y en una pantalla de 360 px el sexto los rompe.
 */
export function BarraInferior({ slug, rol, montados }: Pick<Props, 'slug' | 'rol' | 'montados'>) {
  const ruta = usePathname();
  const [, arranca] = useTransition();
  const principales = utiles(PRINCIPAL, montados);
  const destinos = (rol === 'ADMIN' ? [...principales, ...ADMINISTRACION] : principales).slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-tarjeta lg:hidden">
      <div className="flex h-16 items-center justify-around">
        {destinos.map((i) => {
          const activo = estaActivo(ruta, slug, i);
          return (
            <Link
              key={i.ruta}
              href={`/${slug}/${i.ruta}`}
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
