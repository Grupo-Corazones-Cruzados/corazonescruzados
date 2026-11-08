'use client';

import { appDeTelefono } from '@/lib/sitio/appDeTelefono';
import { definicionTema } from '@/lib/temas';
import { RUTAS_HERRAMIENTA } from '@/lib/herramientas/catalogo';
import '../tema-progreso.css';
import '../temas.css';
import '../movimiento.css';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import AuthGuard from '@/components/providers/AuthGuard';
import PolicyEffectsProvider from '@/components/providers/PolicyEffectsProvider';
import { ProveedorTemaPanel, useTemaPanel } from '@/components/providers/TemaPanel';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import CabeceraMovil from '@/components/dashboard/CabeceraMovil';
import MenuCentralizado from '@/components/centralized/MenuCentralizado';
import MenuAccesos from '@/components/accesos/MenuAccesos';
import MenuProducto from '@/components/productos/MenuProducto';
import { anotarRuta } from '@/components/accesos/nivelMenu';
import { ProveedorMenuMovil } from '@/components/dashboard/MenuMovil';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import DashboardAccessGuard from '@/components/dashboard/DashboardAccessGuard';
import PolicyBanner from '@/components/dashboard/PolicyBanner';
import ChatDock from '@/components/chat/ChatDock';
import NotificationsDock from '@/components/notifications/NotificationsDock';
import AvisoReuniones from '@/components/calendar/AvisoReuniones';
import { HuecoBarraAcciones } from '@/components/dashboard/BarraAcciones';
import AgentePresupuestos from '@/components/sitio/AgentePresupuestos';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PolicyEffectsProvider>
        <ProveedorTemaPanel>
          <ProveedorMenuMovil>
            <Panel>{children}</Panel>
          </ProveedorMenuMovil>
        </ProveedorTemaPanel>
      </PolicyEffectsProvider>
    </AuthGuard>
  );
}

/**
 * ⚠️ Componente aparte y no el cuerpo del layout: `useTemaPanel()` tiene que leerse DENTRO
 * del proveedor, y un componente no puede consumir un contexto que él mismo monta.
 */
function Panel({ children }: { children: React.ReactNode }) {
  const { tema, oscuro } = useTemaPanel();
  const entrada = useEntrada();
  // El espacio de trabajo tiene su cuadro de escritura justo donde flotan estos botones.
  const pathname = usePathname();
  const sinMuelle = pathname.startsWith('/dashboard/admin/espacio');
  // En las apps, Accesos, Herramientas y Centralizado no son Progreso: sin su menú ni su pie.
  const [enApp, setEnApp] = useState(false);
  const seccion = enApp && esSeccionDeApp(pathname);
  // Centralizado se navega con su mapa 4P y la cabecera de siempre (logo → Accesos).
  const enCentralizado = seccion && (pathname === '/dashboard/centralized' || pathname.startsWith('/dashboard/centralized/'));
  // Accesos lleva su propio menú lateral (Apps, Productos, Herramientas) y la cabecera del teléfono.
  const enAccesos = seccion && pathname === '/dashboard/accesos';
  // Un producto dentro de la app: Accesos como primera capa y el menú del producto como segunda.
  const enProducto = seccion && pathname.startsWith('/dashboard/producto/');
  const enHerramienta = seccion && RUTAS_HERRAMIENTA.some((r) => pathname === r || pathname.startsWith(r + '/'));
  const [, , , productoActivo, slugActivo] = pathname.split('/');
  // Después de montar lo nuevo: los menús leen de qué ruta se venía (`nivelMenu`).
  useEffect(() => { anotarRuta(pathname); }, [pathname]);
  const mainRef = useRef<HTMLElement>(null);
  // Las transiciones de teléfono de `movimiento.css` solo corren dentro de una app.
  useEffect(() => {
    const app = appDeTelefono();
    if (app) document.documentElement.dataset.gccApp = app;
    setEnApp(!!app);
  }, []);
  useEntradaTrasCarga(mainRef);
  // Al cambiar de sección en una app cambia el tema (`TemaPanel`): un velo del color del nuevo se
  // desvanece encima, para que el cambio se vea como transición y no como un salto (2026-11-08).
  const [velo, setVelo] = useState<string | null>(null);
  const temaAntes = useRef(tema);
  useEffect(() => {
    if (temaAntes.current === tema) return;
    temaAntes.current = tema;
    if (!enApp) return;
    setVelo(definicionTema(tema)?.muestra.fondo ?? null);
    const t = window.setTimeout(() => setVelo(null), 460);
    return () => window.clearTimeout(t);
  }, [tema, enApp]);

  /**
   * ⇒ EL MENÚ YA NO SE COLAPSA A MANO: se abre al pasar el puntero (ver
   * `DashboardSidebar`). Por eso aquí el margen es SIEMPRE el del raíl estrecho.
   *
   * Es la clave de que funcione: el menú abierto se monta ENCIMA del contenido en vez de
   * empujarlo. Si empujara, la página entera se movería cada vez que el ratón cruza la
   * izquierda camino de otra cosa — y eso marea y hace perder el sitio donde se estaba
   * leyendo.
   */
  return (
    // `tema-progreso`: el estilo de la sección Plataforma de la portada en todo el panel
    // (Fernando, 2026-10-29). Ver `app/tema-progreso.css`. Encima, el tema elegido
    // (`tema-<id>`, ver `app/temas.css`).
    <div className={`corp tema-progreso tema-${tema} ${oscuro ? 'dark' : ''} ${enApp && !seccion ? 'dos-capas' : ''} flex min-h-screen max-lg:h-dvh max-lg:overflow-hidden`}>
      <PolicyBanner collapsed />
      {/* En las apps Progreso va en dos capas: Accesos (raíl) y su propio menú al lado. */}
      {enApp && !seccion && <Suspense fallback={null}><MenuAccesos capa activo="progreso" /></Suspense>}
      {!seccion && <DashboardSidebar />}
      {enCentralizado && <Suspense fallback={null}><MenuAccesos capa activo="centralizado" /></Suspense>}
      {enCentralizado && <MenuCentralizado />}
      {/* Accesos y las herramientas: el menú de Accesos, sin segunda capa (la herramienta abierta, marcada). */}
      {(enAccesos || enHerramienta) && <Suspense fallback={null}><MenuAccesos /></Suspense>}
      {enProducto && <Suspense fallback={null}><MenuAccesos capa activo={`${productoActivo}/${decodeURIComponent(slugActivo ?? '')}`} /></Suspense>}
      {enProducto && <Suspense fallback={null}><MenuProducto /></Suspense>}
      {/* ⇒ LA CABECERA DEL TELÉFONO VA EN EL FLUJO, NO PEGADA A LA VENTANA.
          Empuja al contenido en vez de taparlo, así que **ninguna página puede quedar
          debajo** — no hay «debajo». Por eso el `main` ya no necesita reservar hueco
          arriba: antes llevaba un `pt-[4.5rem]` que era exactamente el alto de la barra
          fija, y aun así el contenido se le metía debajo al desplazarse.
          Ver `CabeceraMovil`. */}
      {/* ⇒ EL `main` VUELVE A SER EL DE SIEMPRE: `overflow-auto min-h-screen`.
          Al meter la cabecera en el flujo lo convertí en un hijo flexible con altura
          acotada, y ahí se torció: **le quité el `min-h-screen` que llevaba desde el
          principio**, y con él la garantía de que la caja del contenido nunca mide menos
          que la ventana. El resultado fue lo contrario de lo que buscaba — el corte se
          mudó de arriba abajo.

          La lección: al reestructurar un contenedor, lo primero es mirar QUÉ CLASES tenía
          y por qué, no solo dónde estaba. Media app depende de que el que se desplaza sea
          este `main` (ver `useAltoHastaElPie`).

          La columna solo apila la cabecera y el contenido; no impone altura ninguna.

          ⇒ EN EL TELÉFONO, LA PÁGINA NO SE DESPLAZA (Fernando, 2026-10-31: «hay deslizamiento
          de página que oculta el header… y es completamente innecesario porque no hay nada de
          contenido»). Cabecera + un `main` de `min-h-screen` medían una pantalla MÁS la
          cabecera, así que siempre sobraba esa franja y al desplazarla se iba la cabecera.
          Por debajo de `lg` la columna mide la pantalla (`h-dvh`), la cabecera se queda fija
          y el único que se desplaza —y solo si su contenido no cabe— es el `main`. En
          escritorio no hay cabecera y todo sigue como siempre. */}
      <div className={`flex-1 min-w-0 flex flex-col ml-0 ${enCentralizado ? 'lg:ml-[22rem]' : seccion && !enAccesos && !enHerramienta ? '' : enApp && !seccion ? 'lg:ml-32' : 'lg:ml-16'} max-lg:min-h-0`}>
        <CabeceraMovil />
        {/* El relleno inferior sale de la MISMA variable que el alto del pie: antes era
            `pb-14` escrito a mano contra un pie de 36 px, y al crecer el pie en teléfono
            el contenido se le habría metido debajo. */}
        <main ref={mainRef} data-entrada={entrada} className={`${sinMuelle ? 'max-lg:!p-0' : ''} flex-1 p-4 md:p-6 pb-[calc(var(--pie-panel)+1.25rem)] overflow-auto lg:min-h-screen max-lg:min-h-0 max-lg:overscroll-contain`}>
          <DashboardAccessGuard>{children}</DashboardAccessGuard>
          {/* Las acciones principales del teléfono (ver `BarraAcciones`): último hijo, para
              que su hueco quede DESPUÉS de todo y la barra no tape el último campo. */}
          <HuecoBarraAcciones />
        </main>
      </div>
      {!seccion && <div className={sinMuelle ? 'max-lg:hidden' : ''}><DashboardBreadcrumb collapsed /></div>}
      {/* Muelle inferior derecho, de derecha a izquierda: campanita · Mis chats · Chat
          (y GCC Bot cuando hay cotización). La campanita es el ancla: los demás se miden
          contra ella. Dentro de `.corp` para heredar el tema. */}
      {!sinMuelle && !seccion && <NotificationsDock />}
      <AvisoReuniones />
      {!sinMuelle && !seccion && <ChatDock />}
      {/* El agente de GCC. A miembros y candidatos además les lee los datos de su cuenta. */}
      {!sinMuelle && !seccion && <AgentePresupuestos />}
      {velo && <div aria-hidden className="cambio-tema" style={{ background: velo }} />}
    </div>
  );
}

/**
 * Hacia dónde se navegó, para la entrada de la página (`app/movimiento.css`): a una ruta MÁS
 * profunda es entrar a un detalle (se acerca), a una menos profunda es volver (desde la
 * izquierda), y a la misma profundidad es cambiar de módulo (desde abajo).
 *
 * Se calcula DURANTE el render con una ref, no en un efecto: el atributo tiene que estar puesto
 * en el mismo pintado en que se monta la página nueva, o la animación ya habría arrancado con la
 * dirección anterior.
 */
function useEntrada(): 'adentro' | 'afuera' | 'lado' {
  const ruta = usePathname() ?? '';
  const prev = useRef<{ ruta: string; dir: 'adentro' | 'afuera' | 'lado' }>({ ruta, dir: 'lado' });
  if (prev.current.ruta !== ruta) {
    const hondo = (r: string) => r.split('/').filter(Boolean).length;
    const a = hondo(prev.current.ruta);
    const b = hondo(ruta);
    prev.current = { ruta, dir: b > a ? 'adentro' : b < a ? 'afuera' : 'lado' };
  }
  return prev.current.dir;
}

/**
 * La página que primero enseña «Cargando…» y después su contenido suele REUTILIZAR el mismo
 * elemento (un `<div>` con el cargador y luego un `<div>` con todo): la animación de entrada ya
 * corrió con el cargador y el contenido aparecería de golpe. Cuando desaparece un cargador
 * (`BrandLoader`: `role=status` con un `.animate-spin`) que estaba a nivel de página —a dos
 * niveles del `main` como mucho, para que el cargador de una tarjeta no mueva la página entera—,
 * el contenido entra con el mismo movimiento. Web Animations sin `fill`: al terminar no queda
 * ningún `transform` puesto (ver `app/movimiento.css`).
 */
function useEntradaTrasCarga(mainRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof MutationObserver === 'undefined') return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)');
    const esCargador = (n: Node) =>
      n instanceof Element && (n.matches('[role=status]') || !!n.querySelector('[role=status]')) && !!n.querySelector('.animate-spin');
    const obs = new MutationObserver((cambios) => {
      // En la app la pantalla ya entró una vez: moverla otra vez al quitarse el cargador es parpadeo.
      if (quieto.matches || document.documentElement.dataset.gccApp) return;
      for (const c of cambios) {
        let nivel = 0;
        for (let el: Node | null = c.target; el && el !== main; el = el.parentNode) nivel++;
        if (nivel > 2 || ![...c.removedNodes].some(esCargador)) continue;
        if (main.querySelector('[role=status] .animate-spin')) continue;
        const pagina = main.firstElementChild;
        pagina?.animate(
          [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
          { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
        );
        return;
      }
    });
    obs.observe(main, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [mainRef]);
}

/**
 * Lo que en las apps es una sección aparte de Progreso (Fernando, 2026-11-08): Accesos, cada
 * herramienta y Centralizado. En la web siguen dentro del panel, como siempre.
 */
const RUTAS_SECCION = ['/dashboard/accesos', '/dashboard/centralized', '/dashboard/producto', ...RUTAS_HERRAMIENTA];
function esSeccionDeApp(ruta: string) {
  return RUTAS_SECCION.some((r) => ruta === r || ruta.startsWith(r + '/'));
}
