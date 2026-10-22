'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Building2,
  Ellipsis,
  ArrowLeft,
} from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { Boton, BotonIcono, BurbujaDetalles, useAparicion, type Detalle } from '@/componentes/ui';
import { LogoHotel } from '@/componentes/Marca';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * «Agenda» salió del menú (Fernando, 2026-09-20): a la agenda se entra por el «+»
 * de cada ubicación en el panel. Sus rutas (y las de una reserva) marcan «Panel»
 * como activo, que es de donde se llega.
 */
const PRINCIPAL = [
  { ruta: 'panel', etiqueta: 'Panel', icono: LayoutDashboard, tambien: ['agenda', 'reserva'] },
  { ruta: 'reportes', etiqueta: 'Reportes', icono: BarChart3, tambien: [] as string[] },
];

const ADMINISTRACION = [
  { ruta: 'usuarios', etiqueta: 'Usuarios', icono: Users, tambien: [] as string[] },
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, tambien: [] as string[] },
];

const estaActivo = (ruta: string, slug: string, item: { ruta: string; tambien: string[] }) =>
  [item.ruta, ...item.tambien].some((r) => ruta.startsWith(`/${slug}/${r}`));

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

/** Los destinos que ve cada rol, en el orden del menú. */
const destinosDe = (rol: RolUsuario) => (rol === 'ADMIN' ? [...PRINCIPAL, ...ADMINISTRACION] : PRINCIPAL);

/**
 * LO DE DENTRO DEL MENÚ — cabecera con la marca, los grupos y el pie con la persona y
 * «Cerrar sesión». UNA definición para los dos sitios donde se ve: el raíl del
 * escritorio (que se contrae a iconos) y el panel que sale por la izquierda en el
 * teléfono al pulsar «Más» (siempre desplegado).
 */
function ContenidoMenu({ slug, hotel, logoUrl, usuario, rol, colapsado = false }: Props & { colapsado?: boolean }) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const esAdmin = rol === 'ADMIN';

  const Enlace = ({ item }: { item: (typeof PRINCIPAL)[number] }) => {
    const href = `/${slug}/${item.ruta}`;
    const activo = estaActivo(ruta, slug, item);
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
      <div className={cn('flex h-[68px] shrink-0 items-center gap-3 border-b border-borde', colapsado ? 'justify-center px-0' : 'px-4')}>
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

      <div className="shrink-0 border-t border-borde p-3">
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
    </>
  );
}

/** Barra lateral (escritorio). En el teléfono manda la barra inferior, con su «Más». */
export function BarraLateral(props: Props) {
  /**
   * EL MENÚ SE CONTRAE A LOS ICONOS Y SE DESPLIEGA AL PASAR EL PUNTERO (Fernando,
   * 2026-09-16: «como ya lo hacemos en la app principal»). Mismo mecanismo que el raíl
   * de GCC World: se monta ENCIMA del contenido —el main conserva siempre el margen
   * del raíl estrecho— y cada fila mide lo mismo abierto o cerrado, así lo que está
   * bajo el puntero no se escapa al desplegarse. En táctil no hay puntero: ahí manda
   * la barra inferior, con su «Más».
   */
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const colapsado = !sobreElMenu;

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
        <ContenidoMenu {...props} colapsado={colapsado} />
      </aside>
    </>
  );
}

/**
 * Barra inferior (teléfono). Como mucho cuatro destinos y «Más» (Fernando, 2026-10-22:
 * el último era «Salir» y no dejaba llegar al resto del menú). «Más» abre el MISMO menú
 * del escritorio en un panel que sale por la izquierda; «Cerrar sesión» vive ahí, como
 * en el escritorio.
 */
export function BarraInferior(props: Props) {
  const { slug, rol } = props;
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const { montado, visible } = useAparicion(abierto);
  // Como mucho cinco: más iconos en una fila de móvil dejan de poder pulsarse.
  const destinos = destinosDe(rol).slice(0, 4);
  const enOtro = !destinos.some((i) => estaActivo(ruta, slug, i));

  // Al llegar a otra pantalla el panel ya cumplió: se cierra solo.
  useEffect(() => setAbierto(false), [ruta]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return (
    <>
      {/* En modo app (`viewportFit: cover`) la barra de inicio del iPhone queda debajo: se le deja su sitio. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-tarjeta pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        <div className="flex h-16 items-center justify-around">
          {destinos.map((i) => {
            const href = `/${slug}/${i.ruta}`;
            const activo = estaActivo(ruta, slug, i);
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
            onClick={() => setAbierto(true)}
            aria-expanded={abierto}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors',
              enOtro || abierto ? 'text-acento' : 'text-tenue',
            )}
          >
            <Ellipsis className="h-5 w-5" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {/* Se MONTA solo mientras se ve (escondido no debe existir) y entra y sale
          deslizándose desde la izquierda, con el velo fundiéndose (`useAparicion`). */}
      {montado && (
        <div className={cn('fixed inset-0 z-50 lg:hidden print:hidden', !abierto && 'pointer-events-none')}>
          <div
            aria-hidden
            onClick={() => setAbierto(false)}
            className={cn('absolute inset-0 bg-black/45 transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            // Pulsar la pantalla en la que ya se está no cambia la ruta: se cierra igual.
            onClick={(e) => (e.target as HTMLElement).closest('a') && setAbierto(false)}
            className={cn(
              'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-borde bg-tarjeta pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl',
              'transition-transform duration-200 ease-out',
              visible ? 'translate-x-0' : '-translate-x-full',
            )}>
            <ContenidoMenu {...props} />
          </aside>
        </div>
      )}
    </>
  );
}

/** Una acción secundaria: botón en escritorio, opción del menú «⋯» en el teléfono. */
export type AccionMenu = {
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  alPulsar?: () => void;
  /** Enlace en vez de acción; con `descargar` se baja el archivo. */
  href?: string;
  descargar?: boolean;
  peligro?: boolean;
  deshabilitado?: boolean;
  titulo?: string;
};

/** Donde la barra de acciones del teléfono se monta: al final del contenido, encima de la barra inferior. */
export const ID_BARRA_ACCIONES = 'barra-acciones-movil';

/**
 * El hueco de la barra de acciones en el teléfono. Va como ÚLTIMO hijo del contenido y es
 * `sticky`: ocupa su propio sitio en el flujo, así que al final de la página nada queda debajo
 * de ella, y mientras se baja se queda pegada encima de la barra inferior. Vacío, no ocupa nada.
 */
export function HuecoBarraAcciones() {
  return <div id={ID_BARRA_ACCIONES} className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mt-auto empty:hidden lg:hidden print:hidden" />;
}

/*
  Cabecera de página. En el teléfono los botones con texto no se amontonan arriba:
  - `acciones` son las PRINCIPALES (nueva reserva, registrar salida, exportar…): van a una barra propia abajo,
    centradas, encima de la barra inferior;
  - `menu` son las SECUNDARIAS: van dentro del botón «⋯» junto al título.
  En escritorio todo sigue en la cabecera: las secundarias primero, las principales a la derecha.
  `extra` es información (no un botón): va bajo la descripción, en todos los anchos.
  `volver` pone una flecha antes del título (en vez de un enlace «Todos los…» que gasta una fila).
  `descripcion` y `detalles` (correo, teléfono, fechas) NO se escriben bajo el título: van en la
  burbuja del botón (i) junto al título, en todos los anchos. Bajo el título solo queda `extra`.
*/
export function CabeceraPagina({
  titulo,
  descripcion,
  acciones,
  menu,
  extra,
  volver,
  detalles,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  menu?: AccionMenu[];
  extra?: React.ReactNode;
  volver?: { href: string; etiqueta: string };
  detalles?: Detalle[];
}) {
  const [hueco, setHueco] = useState<HTMLElement | null>(null);
  useEffect(() => setHueco(document.getElementById(ID_BARRA_ACCIONES)), []);
  const hayMenu = !!menu?.length;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-3.5 sm:px-6 lg:flex-wrap print:hidden">
      <div className="flex min-w-0 items-start gap-2">
        {volver && (
          <Link href={volver.href} aria-label={volver.etiqueta} title={volver.etiqueta}
            className="foco-visible -ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-tenue transition-colors hover:bg-realce hover:text-texto">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <h1 className="truncate text-[17px] font-semibold text-texto">{titulo}</h1>
            {(descripcion || !!detalles?.length) && (
              <BurbujaDetalles texto={descripcion} detalles={detalles} titulo={detalles?.length ? `Datos de ${titulo}` : 'Ayuda'} className="shrink-0" />
            )}
          </div>
          {extra && <div className="mt-1.5">{extra}</div>}
        </div>
      </div>
      {hayMenu && <MenuMas acciones={menu!} />}
      {(acciones || hayMenu) && (
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          {menu?.map((a) => <BotonAccion key={a.etiqueta} accion={a} />)}
          {acciones}
        </div>
      )}
      {acciones && hueco && createPortal(
        <div className="border-t border-borde bg-tarjeta px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex max-w-md items-center justify-center gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&_button]:w-full [&_button]:justify-center">
            {acciones}
          </div>
        </div>,
        hueco,
      )}
    </div>
  );
}

/**
 * Las acciones de una TARJETA (p. ej. una ubicación en Configuración): botones en escritorio y «⋯» en el
 * teléfono, por la misma regla que la cabecera; va a la derecha del título de la tarjeta.
 */
export function AccionesTarjeta({ acciones }: { acciones: AccionMenu[] }) {
  return (
    <>
      <div className="hidden flex-wrap gap-2 lg:flex">
        {acciones.map((a) => <BotonAccion key={a.etiqueta} accion={a} tamano="sm" />)}
      </div>
      <MenuMas acciones={acciones} />
    </>
  );
}

// La destructiva sale con borde y texto rojo, no rellena: es secundaria.
function BotonAccion({ accion: a, tamano }: { accion: AccionMenu; tamano?: 'sm' }) {
  const boton = (
    <Boton variante="secundario" tamano={tamano} icono={a.icono} onClick={a.alPulsar} disabled={a.deshabilitado} title={a.titulo}
      className={a.peligro ? 'text-error hover:text-error' : undefined}>
      {a.etiqueta}
    </Boton>
  );
  if (!a.href || a.deshabilitado) return boton;
  return a.descargar ? <a href={a.href} download>{boton}</a> : <Link href={a.href}>{boton}</Link>;
}

/** El «⋯» del teléfono con las acciones secundarias; entra y sale con movimiento. */
function MenuMas({ acciones }: { acciones: AccionMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  const { montado, visible } = useAparicion(abierto);
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);

  const opcion = 'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-realce disabled:opacity-50';
  return (
    <div className="relative shrink-0 lg:hidden">
      <BotonIcono icono={Ellipsis} titulo="Más acciones" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto((v) => !v)}
        className={cn('border border-borde', abierto && 'bg-realce text-texto')} />
      {montado && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div role="menu"
            className={cn(
              'absolute right-0 top-full z-50 mt-1.5 w-60 origin-top-right overflow-hidden rounded-md border border-borde bg-tarjeta py-1 shadow-lg',
              'transition duration-200 ease-out',
              visible ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
            )}>
            {acciones.map((a) => {
              const Icono = a.icono;
              const contenido = <><Icono className="h-4 w-4 shrink-0" />{a.etiqueta}</>;
              const clase = cn(opcion, a.peligro ? 'text-error' : 'text-texto');
              const cerrar = () => setAbierto(false);
              if (a.href && !a.deshabilitado)
                return a.descargar
                  ? <a key={a.etiqueta} role="menuitem" href={a.href} download className={clase} onClick={cerrar}>{contenido}</a>
                  : <Link key={a.etiqueta} role="menuitem" href={a.href} className={clase} onClick={cerrar}>{contenido}</Link>;
              return (
                <button key={a.etiqueta} type="button" role="menuitem" disabled={a.deshabilitado} title={a.titulo} className={clase}
                  onClick={() => { cerrar(); a.alPulsar?.(); }}>
                  {contenido}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export const IconoUbicacion = Building2;
