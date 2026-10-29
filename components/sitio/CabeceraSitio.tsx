'use client';

/**
 * CABECERA DEL SITIO PÚBLICO — definición ÚNICA, compartida por la portada y las páginas
 * de Soluciones, Desarrollo Humano y Contacto.
 *
 * ── DOS MODOS, Y POR QUÉ ───────────────────────────────────────────────────────
 * · `flotante` — para la PORTADA. Va superpuesta y transparente, y solo se opaca al
 *   desplazar. La portada es una experiencia a pantalla completa con pixel art; una barra
 *   sólida encima le corta la cabeza a la escena.
 * · normal — para las páginas de contenido. Fija arriba, con fondo y borde.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────────
 * No lleva buscador ni menús desplegables. Los destinos caben en una fila y un menú que se
 * abre para mostrar dos enlaces es un clic de más.
 *
 * ── ⚠️ EL MENÚ DE MÓVIL ENTRA EN `lg`, NO EN `md` (2026-08-17) ─────────────────
 * Entraba en `md` (768 px), y con cuatro destinos cabía. Al añadir «Ámbitos» y el botón
 * «Plataforma» dejó de caber: **medido, la fila pedía 815 px dentro de 768** y la barra se
 * desbordaba en la franja de 768 a ~830 px — tabletas en vertical. Ni `tsc` ni el build ven
 * eso; solo aparece midiendo el ancho real a varios tamaños.
 *
 * 👉 **Al añadir otra pestaña, vuelve a medirlo.** Cada una son ~90 px más.
 *
 * Y **no lleva botón de «Crear cuenta»** (decisión de Fernando, 2026-08-02). Lo llevó, y
 * empujaba a registrarse desde la primera pantalla, antes de haber contado nada. El alta
 * sigue estando donde tiene sentido: al final de `/clientes`, después de decir qué se hace
 * y cómo funciona el precio.
 *
 * ── YA NO LLEVA «PLATAFORMA» (Fernando, 2026-10-26) ──────────────────────────
 * Lo llevó del 2026-08-17 al 2026-10-26, como botón violeta a la derecha de «Contacto».
 * Volvió al héroe de la portada con el nombre «Progreso», junto a «Aventura»
 * (`app/page.tsx`). La barra queda solo con navegación.
 *
 * ── SOBRE LA PORTADA PARTIDA (2026-10-26) ──────────────────────────────────────
 * En la portada (`flotante`) las pestañas van en una CÁPSULA de cristal oscuro centrada
 * justo sobre la raya Aventura | Progreso: se leen igual sobre el cielo y sobre la
 * Plataforma clara, y marcan la unión de los dos mundos. El botón del menú del teléfono es
 * de cristal por lo mismo.
 *
 * ── SIEMPRE CON FONDO (Fernando, 2026-10-26) ─────────────────────────────────────
 * En la portada era transparente y se volvía sólida al desplazar. Ahora lleva SIEMPRE ese
 * fondo oscuro con desenfoque («que mantenga ese fondo que se ve cuando se desliza»).
 *
 * ── LA MISMA CABECERA EN LAS CUATRO PESTAÑAS, Y UNA CÁPSULA QUE SE DESLIZA (Fernando, 2026-10-29) ──
 * «que la experiencia de transición sea animada al cambiar a las pestañas… que estas páginas
 * compartan el mismo estilo de header». Hasta aquí la portada llevaba la cápsula centrada y las
 * demás páginas las pestañas sueltas a la derecha, sobre un fondo que el papel claro volvía gris.
 * Ahora es UNA sola forma: la cápsula centrada desde `md` (hamburguesa por debajo) y el fondo casi
 * opaco, igual sobre el cielo, la Plataforma o el papel. La pestaña activa la marca una píldora
 * (`.pestana-indicador`) que, al cambiar de página, sale de la pestaña ANTERIOR y se desliza hasta
 * la nueva —también entre la portada y el resto, aunque la cabecera se remonte: de dónde se viene
 * lo guarda `lib/sitio/pestanaAnterior.ts`—. El cuerpo entra desde ese lado (`TransicionSeccion`).
 * Se deroga el modo «normal» (pestañas a la derecha, menú del teléfono hasta `lg`).
 */

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAVEGACION } from '@/lib/sitio/contenido';
import { pestanaDe, recordarRuta, rutaAnterior } from '@/lib/sitio/pestanaAnterior';

const ESTILO_INDICADOR: CSSProperties = {
  position: 'absolute',
  top: 4,
  bottom: 4,
  left: 0,
  width: 0,
  opacity: 0,
  borderRadius: 9999,
  pointerEvents: 'none',
  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.38), rgba(192, 38, 211, 0.26))',
  boxShadow: 'inset 0 0 0 1px rgba(196, 181, 253, 0.28), 0 6px 18px -8px rgba(139, 92, 246, 0.8)',
};

export default function CabeceraSitio() {
  const pathname = usePathname() || '/';
  const [abierto, setAbierto] = useState(false);

  /**
   * LA PÍLDORA DE LA PESTAÑA ACTIVA. Se coloca midiendo el enlace (estilo directo, sin estado: así
   * el primer cuadro ya la pinta donde va). Si se viene de otra pestaña, primero se pone en la
   * de antes sin transición y en el cuadro siguiente se desliza a la nueva. Hasta que se coloca
   * por primera vez (HTML del servidor), el enlace activo lleva su propio fondo de respaldo.
   */
  const navRef = useRef<HTMLElement>(null);
  const indicadorRef = useRef<HTMLSpanElement>(null);
  const [indicadorListo, setIndicadorListo] = useState(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const ind = indicadorRef.current;
    if (!nav || !ind) return;
    const enlace = (href: string | null) =>
      href ? nav.querySelector<HTMLElement>(`a[data-pestana="${CSS.escape(href)}"]`) : null;
    const poner = (el: HTMLElement, animar: boolean) => {
      ind.style.transition = animar
        ? 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease'
        : 'none';
      ind.style.opacity = '1';
      ind.style.transform = `translateX(${el.offsetLeft}px)`;
      ind.style.width = `${el.offsetWidth}px`;
    };
    const destino = enlace(pestanaDe(pathname));
    const origen = enlace(pestanaDe(rutaAnterior()));
    recordarRuta(pathname);
    if (!destino) {
      ind.style.opacity = '0';
      return;
    }
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cuadro = 0;
    if (origen && origen !== destino && !quieto) {
      poner(origen, false);
      void ind.offsetWidth; // fija la posición de partida antes de animar
      cuadro = requestAnimationFrame(() => poner(destino, true));
    } else {
      poner(destino, false);
    }
    setIndicadorListo(true);
    // Si cambia el ancho (fuentes que cargan, ventana), se recoloca sin animar. ⚠️ El observador
    // avisa una vez nada más empezar: sin comparar el ancho, ese aviso cortaba el deslizamiento.
    let ancho = nav.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (nav.offsetWidth === ancho) return;
      ancho = nav.offsetWidth;
      poner(destino, false);
    });
    ro.observe(nav);
    return () => {
      cancelAnimationFrame(cuadro);
      ro.disconnect();
    };
  }, [pathname]);

  return (
    <>
    {/* EL VELO DEL MENÚ DEL TELÉFONO (Fernando, 2026-10-27: «debajo del menú un overlay para
        distinguir que tenemos abierto el menú»). Va FUERA del `<header>`: con su
        `backdrop-filter`, un `fixed` dentro quedaría encerrado en la cabecera. Tocarlo cierra. */}
    {abierto && (
      <div
        aria-hidden="true"
        onClick={() => setAbierto(false)}
        className="velo-menu fixed inset-0 z-[59] bg-black/55 backdrop-blur-[2px] md:hidden"
      />
    )}
    <header
      // `pt` = la zona de la hora y la batería del teléfono (app instalada / `viewport-fit: cover`):
      // sin él la cabecera quedaba debajo de ellas (Fernando, 2026-10-27). En el navegador vale 0.
      // Fondo OSCURO casi opaco: con el 85 % de antes, el papel claro de debajo lo volvía gris en
      // las páginas de contenido (2026-10-29). Va EN LÍNEA, no como clase: el servidor de
      // desarrollo de Fernando sirve a veces un CSS viejo, y sin la clase la barra salía clara.
      className="fixed top-0 inset-x-0 z-[60] pt-[var(--seguro-arriba)] backdrop-blur-xl border-b border-white/[0.07]"
      style={{ backgroundColor: 'rgba(11, 13, 20, 0.96)' }}
    >
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group" onClick={() => setAbierto(false)}>
          {/* El logo REAL de la organización: los corazones cruzados.
              `public/logo-gcc.png` sale de `LogoApp.png` recortado al círculo —así se va la
              marca de agua de la herramienta con la que se dibujó— y reducido a 256 px:
              de 567 kB a 71 kB, que es lo que puede permitirse una cabecera. */}
          <Image
            src="/logo-gcc.png"
            alt=""
            width={30}
            height={30}
            priority
            className="shrink-0 rounded-full"
          />
          <span
            className="text-[15px] font-semibold text-white tracking-tight group-hover:text-[#c4b5fd] transition-colors md:max-[999px]:hidden"
          >
            Grupo Corazones Cruzados
          </span>
        </Link>

        <nav
          // En la portada la cápsula aparece ya desde `md` (Fernando, 2026-10-26: con su
          // ventana de ~1000 px salía la hamburguesa y «se veían perfecto» las pestañas). Entre
          // `md` y 1100 px, compacta; y por debajo de 1000 px el nombre se esconde (queda el
          // logo), o la cápsula centrada lo pisaría. La hamburguesa, solo en el teléfono.
          ref={navRef}
          className="hidden md:flex items-center gap-1 cristal-portada absolute left-1/2 -translate-x-1/2 rounded-full p-1"
          aria-label="Principal"
        >
          {/* Su forma va EN LÍNEA (no solo en `.pestana-indicador`): sin el CSS al día, el
              `<span>` quedaba en el flujo y empujaba las pestañas a la derecha. */}
          <span ref={indicadorRef} className="pestana-indicador" aria-hidden="true" style={ESTILO_INDICADOR} />
          {NAVEGACION.map((n) => {
            const activo = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                data-pestana={n.href}
                aria-current={activo ? 'page' : undefined}
                className={`relative z-[1] py-2 transition-colors duration-300 rounded-full px-3 text-[13px] min-[1100px]:px-4 min-[1100px]:text-[13.5px] ${
                  activo
                    ? `text-white ${indicadorListo ? '' : 'bg-white/[0.1]'}`
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                {n.label}
              </Link>
            );
          })}

        </nav>

        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          className="ml-auto w-9 h-9 inline-flex items-center justify-center text-white/80 hover:bg-white/[0.07] md:hidden cristal-portada rounded-full"
        >
          {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {abierto && (
        <nav className={`menu-sitio-movil md:hidden border-t border-white/[0.07] px-5 py-3 flex flex-col gap-1`} aria-label="Principal">
          {NAVEGACION.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setAbierto(false)}
              className="px-3 py-2.5 rounded-md text-[14px] text-white/75 hover:text-white hover:bg-white/[0.06]"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
    </>
  );
}
