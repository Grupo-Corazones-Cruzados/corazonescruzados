'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { LayoutDashboard, BookOpenText, UserRound, Settings, LogOut, GraduationCap, Users, Ellipsis, ArrowLeft, ChevronDown } from 'lucide-react';
import { salir } from '@/acciones/acceso';
import { Boton, BotonIcono, BurbujaDetalles, useAparicion, type Detalle } from '@/componentes/ui';
import { LogoNegocio } from '@/componentes/Marca';
import { puede, ETIQUETA_ROL, type Capacidad } from '@/lib/permisos';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';
import { conBase } from '@/lib/base';

type Destino = {
  ruta: string;
  etiqueta: string;
  icono: React.ComponentType<{ className?: string }>;
  necesita: Capacidad;
  grupo: string;
  /** Otras rutas que marcan este destino como activo (se llega desde él). */
  tambien?: string[];
};

/**
 * El menú se arma por CAPACIDAD: el profesor ve inicio, planificaciones y su
 * perfil; el administrador además usuarios y configuración (Fernando,
 * 2026-09-15: «otro de usuarios que solo el cliente debe poder acceder»).
 */
const DESTINOS: Destino[] = [
  { ruta: 'panel', etiqueta: 'Inicio', icono: LayoutDashboard, necesita: 'ver', grupo: 'Principal' },
  { ruta: 'planificaciones', etiqueta: 'Planificaciones', icono: BookOpenText, necesita: 'planificar', grupo: 'Principal' },
  { ruta: 'estudiantes', etiqueta: 'Estudiantes', icono: Users, necesita: 'planificar', grupo: 'Principal' },
  { ruta: 'perfil', etiqueta: 'Mi perfil', icono: UserRound, necesita: 'ver', grupo: 'Principal' },
  { ruta: 'unidades', etiqueta: 'Unidades', icono: GraduationCap, necesita: 'administrar', grupo: 'Administración' },
  // «Negocio» y «Usuarios» ya no son destinos: viven en Configuración ▸ Negocio / Usuarios, como
  // en Automatizaciones (Fernando, 2026-11-08). Sus rutas viejas redirigen allí.
  { ruta: 'configuracion', etiqueta: 'Configuración', icono: Settings, necesita: 'administrar', grupo: 'Administración', tambien: ['negocio', 'usuarios', 'suscripcion'] },
];

const estaActivo = (ruta: string, slug: string, d: Destino) =>
  [d.ruta, ...(d.tambien ?? [])].some((r) => ruta === `/${slug}/${r}` || ruta.startsWith(`/${slug}/${r}/`));

const destinosDe = (rol: RolUsuario) => DESTINOS.filter((d) => puede(rol, d.necesita));

const agrupar = (ds: Destino[]) => {
  const grupos: { titulo: string; destinos: Destino[] }[] = [];
  for (const d of ds) {
    const g = grupos.find((x) => x.titulo === d.grupo);
    if (g) g.destinos.push(d);
    else grupos.push({ titulo: d.grupo, destinos: [d] });
  }
  return grupos;
};

type Props = { slug: string; institucion: string; logoUrl: string | null; usuario: string; rol: RolUsuario };

/**
 * LO DE DENTRO DEL MENÚ — cabecera con la marca, los grupos y el pie con la persona y
 * «Cerrar sesión». UNA definición para los dos sitios donde se ve: el raíl del
 * escritorio (que se contrae a iconos) y el panel que sale por la izquierda en el
 * teléfono al pulsar «Más» (siempre desplegado).
 */
function ContenidoMenu({ slug, institucion, logoUrl, usuario, rol, colapsado = false }: Props & { colapsado?: boolean }) {
  const ruta = usePathname();
  const [saliendo, arranca] = useTransition();
  const grupos = agrupar(destinosDe(rol));

  const Enlace = ({ d }: { d: Destino }) => {
    const href = `/${slug}/${d.ruta}`;
    const activo = estaActivo(ruta, slug, d);
    return (
      <Link
        href={href}
        title={colapsado ? d.etiqueta : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-md h-9 text-[13px] transition-colors foco-visible',
          colapsado ? 'justify-center px-0' : 'px-3',
          // Sin borde a la izquierda (Fernando, 2026-11-08: «quitar esa sombra que tiene cada
          // opción»). Lo elegido se marca solo con el fondo y el color, como en GCC World.
          activo ? 'bg-acento-suave font-semibold text-acento' : 'text-texto hover:bg-realce',
        )}
      >
        <d.icono className={cn('h-[18px] w-[18px] shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        {!colapsado && <span className="truncate">{d.etiqueta}</span>}
      </Link>
    );
  };

  return (
    <>
      <div className={cn('flex h-[68px] shrink-0 items-center gap-3 border-b border-borde', colapsado ? 'justify-center px-0' : 'px-4')}>
        <LogoNegocio nombre={institucion} logoUrl={logoUrl} tamano={36} />
        {!colapsado && <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-texto">{institucion}</p>
          <p className="text-[10px] text-tenue">Planificación de Clases</p>
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

      <div className="shrink-0 border-t border-borde p-3">
        <div className={cn('mb-2 flex h-8 items-center gap-2.5', colapsado ? 'justify-center' : 'px-1')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[12px] font-bold text-acento">
            {usuario.charAt(0).toUpperCase()}
          </div>
          {!colapsado && <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-texto">{usuario}</p>
            <p className="text-[10px] text-tenue">{ETIQUETA_ROL[rol]}</p>
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
          // Empieza bajo la franja de aviso (demostración) si la hay: `--alto-aviso`.
          'fixed bottom-0 left-0 top-[var(--alto-aviso,0px)] z-40 hidden flex-col border-r border-borde bg-tarjeta lg:flex transition-[width] duration-200 print:hidden',
          colapsado ? 'w-16' : 'w-60 shadow-2xl',
        )}
      >
        <ContenidoMenu {...props} colapsado={colapsado} />
      </aside>
    </>
  );
}

/**
 * Barra inferior para el teléfono: un docente dicta la semana desde el celular.
 *
 * Cuatro destinos y «Más» (Fernando, 2026-10-22: el quinto era «Salir» y no dejaba
 * llegar al resto del menú). «Más» abre el MISMO menú del escritorio en un panel que
 * sale por la izquierda; «Cerrar sesión» vive ahí, como en el escritorio.
 */
export function BarraInferior(props: Props) {
  const { slug, rol } = props;
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const { montado, visible } = useAparicion(abierto);
  // Como mucho cinco: más iconos en una fila de móvil dejan de poder pulsarse.
  const destinos = destinosDe(rol).slice(0, 4);
  const enOtro = !destinos.some((d) => estaActivo(ruta, slug, d));

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
          {destinos.map((d) => {
            const href = `/${slug}/${d.ruta}`;
            const activo = estaActivo(ruta, slug, d);
            return (
              <Link
                key={d.ruta}
                href={href}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors',
                  activo ? 'text-acento' : 'text-tenue',
                )}
              >
                <d.icono className="h-5 w-5" />
                <span className="max-w-full truncate">{d.etiqueta}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setAbierto(true)}
            aria-expanded={abierto}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors',
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
              'superficie-flotante absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-borde bg-tarjeta pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl',
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

/** Donde la barra de acciones del teléfono se monta: al final del `main` que se desplaza, encima de la barra inferior. */
export const ID_BARRA_ACCIONES = 'barra-acciones-movil';

/**
 * El hueco de la barra de acciones en el teléfono. Va como ÚLTIMO hijo del `main` que se
 * desplaza y es `sticky`: ocupa su propio sitio en el flujo, así que al final de la página nada
 * queda debajo de ella, y mientras se baja se queda pegada encima de la barra inferior. Vacío,
 * no ocupa nada.
 *
 * ⚠️ AQUÍ ES `bottom-0`, no `bottom-[4rem+…]` como en Catering. En Catering el contenido se
 * desplaza con la ventana; aquí se desplaza el `main`, y lo `sticky` se pega al borde de SU
 * caja descontado su relleno —medido: con `bottom-16` quedaban 64 px de hueco sobre la barra
 * inferior—. Ese relleno (`pb-[calc(4rem+…)]`) ya es el sitio de la barra inferior, así que
 * con `bottom-0` queda apoyada justo encima. Y `mt-auto` la baja al fondo en una página corta
 * (`main` es `flex-col`).
 */
export function HuecoBarraAcciones() {
  return <div id={ID_BARRA_ACCIONES} className="sticky bottom-0 z-30 mt-auto empty:hidden lg:hidden print:hidden" />;
}

/*
  Cabecera de página. En el teléfono los botones con texto no se amontonan arriba:
  - `acciones` son las PRINCIPALES (aprobar, rechazar, nuevo…): van a una barra propia abajo,
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
  tituloTelefono,
  volverTelefono,
  accionesTelefono,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  menu?: AccionMenu[];
  extra?: React.ReactNode;
  volver?: { href: string; etiqueta: string };
  detalles?: Detalle[];
  /**
   * Una sección abierta en el teléfono (ver `Secciones`): su nombre sustituye al título y
   * una flecha vuelve a la portada. En escritorio no cambia nada.
   */
  tituloTelefono?: string;
  volverTelefono?: { href: string; etiqueta: string };
  /** Principales que SOLO van a la barra de abajo del teléfono (en escritorio viven en su tarjeta). */
  accionesTelefono?: React.ReactNode;
}) {
  const [hueco, setHueco] = useState<HTMLElement | null>(null);
  useEffect(() => setHueco(document.getElementById(ID_BARRA_ACCIONES)), []);
  const hayMenu = !!menu?.length;

  return (
    <div className="flex min-h-[68px] items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-2 sm:px-6 lg:flex-wrap print:hidden">
      {/* ALTO MÍNIMO = el de la cabecera del menú (68 px), para que sus bordes inferiores queden en
        la misma línea (Fernando, 2026-11-08). Con la línea de estado (`extra`) también cabe en 68. */}
      <div className="flex min-w-0 items-start gap-2">
        {volver && (
          <Link href={volver.href} aria-label={volver.etiqueta} title={volver.etiqueta}
            className="foco-visible -ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-tenue transition-colors hover:bg-realce hover:text-texto">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        {volverTelefono && (
          <Link href={volverTelefono.href} aria-label={volverTelefono.etiqueta} title={volverTelefono.etiqueta}
            className="foco-visible -ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-tenue transition-colors hover:bg-realce hover:text-texto lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            {tituloTelefono ? (
              <h1 className="truncate text-[17px] font-semibold leading-6 text-texto">
                <span className="lg:hidden">{tituloTelefono}</span>
                <span className="hidden lg:inline">{titulo}</span>
              </h1>
            ) : (
              <h1 className="truncate text-[17px] font-semibold leading-6 text-texto">{titulo}</h1>
            )}
            {(descripcion || !!detalles?.length) && (
              <BurbujaDetalles texto={descripcion} detalles={detalles} titulo={detalles?.length ? `Datos de ${titulo}` : 'Ayuda'} className="shrink-0" />
            )}
          </div>
          {extra && <div className="mt-0.5 leading-4">{extra}</div>}
        </div>
      </div>
      {hayMenu && <MenuMas acciones={menu!} />}
      {(acciones || hayMenu) && (
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          {menu?.map((a) => <BotonAccion key={a.etiqueta} accion={a} />)}
          {acciones}
        </div>
      )}
      {(acciones || accionesTelefono) && hueco && createPortal(
        <div className="border-t border-borde bg-tarjeta px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex max-w-md items-center justify-center gap-2 [&>*]:min-w-0 [&>*]:flex-1 [&_button]:w-full [&_button]:justify-center">
            {acciones}
            {accionesTelefono}
          </div>
        </div>,
        hueco,
      )}
    </div>
  );
}

/**
 * Las acciones de una TARJETA (p. ej. el servicio vigente): botones en escritorio y «⋯» en el
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
  return a.descargar ? <a href={conBase(a.href)} download>{boton}</a> : <Link href={a.href}>{boton}</Link>;
}

/** El «⋯» del teléfono con las acciones secundarias; entra y sale con movimiento. */
/**
 * Las acciones de una FILA de tabla: SIEMPRE un «⋯» que abre la lista, en todos los anchos
 * (Fernando, 2026-11-08: «los botones tienen que ser un botón de más que al hacer clic abra una
 * lista de opciones»). Nunca una columna de botones con texto.
 */
export function MenuFila({ acciones }: { acciones: AccionMenu[] }) {
  return <MenuMas acciones={acciones} siempre />;
}

/**
 * UN BOTÓN CON TEXTO QUE DESPLIEGA OPCIONES (regla «Botón que despliega variantes», 2026-10-30):
 * el mismo menú del «⋯», con su animación y su cierre, pero con texto, icono y flecha.
 */
export function MenuBoton({ texto, icono, acciones }: { texto: string; icono?: React.ComponentType<{ className?: string }>; acciones: AccionMenu[] }) {
  return <MenuMas acciones={acciones} siempre boton={{ texto, icono }} />;
}

function MenuMas({ acciones, siempre = false, boton: conTexto }: {
  acciones: AccionMenu[];
  siempre?: boolean;
  boton?: { texto: string; icono?: React.ComponentType<{ className?: string }> };
}) {
  const [abierto, setAbierto] = useState(false);
  const { montado, visible } = useAparicion(abierto);
  /*
    SE MIDE Y SE ENCAJA (regla /diseno §4-quater): `fixed`, pegado al botón por la derecha y,
    si no cabe debajo, hacia arriba. Con `absolute` lo recortaba la tarjeta de la tabla en la
    última fila (Fernando, 2026-11-08).
  */
  const boton = useRef<HTMLButtonElement>(null);
  const [sitio, setSitio] = useState<{ top?: number; bottom?: number; right: number }>({ right: 16 });
  const abrir = () => {
    const r = boton.current?.getBoundingClientRect();
    if (r) {
      const alto = acciones.length * 41 + 10;
      const right = Math.max(8, window.innerWidth - r.right);
      setSitio(window.innerHeight - r.bottom < alto + 12 ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right });
    }
    setAbierto((v) => !v);
  };
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    window.addEventListener('scroll', cerrar, true);
    window.addEventListener('resize', cerrar);
    return () => { window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar); };
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);

  const opcion = 'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-realce disabled:opacity-50';
  return (
    <div className={cn('relative shrink-0', !siempre && 'lg:hidden')}>
{conTexto ? (
        <Boton ref={boton} variante="secundario" icono={conTexto.icono} aria-expanded={abierto} aria-haspopup="menu" onClick={abrir}
          className={cn(abierto && 'bg-realce')}>
          {conTexto.texto}
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Boton>
      ) : (
            <BotonIcono ref={boton} icono={Ellipsis} titulo="Más acciones" aria-expanded={abierto} aria-haspopup="menu" onClick={abrir}
        className={cn('border border-borde', abierto && 'bg-realce text-texto')} />
      )}
      {montado && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div role="menu"
            style={sitio}
            className={cn(
              'superficie-flotante fixed z-50 w-60 overflow-hidden rounded-md border border-borde bg-tarjeta py-1 shadow-lg',
              sitio.bottom !== undefined ? 'origin-bottom-right' : 'origin-top-right',
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
                  ? <a key={a.etiqueta} role="menuitem" href={conBase(a.href)} download className={clase} onClick={cerrar}>{contenido}</a>
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
