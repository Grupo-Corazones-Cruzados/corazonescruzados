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
 * Transparente sobre la portada, sus textos cruzan la raya Aventura | Progreso: blancos
 * en el cielo, oscuros sobre la Plataforma clara (`lib/sitio/portadaPartida.ts`). En
 * cuanto la barra se vuelve sólida, vuelven a ser blancos sin más.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAVEGACION } from '@/lib/sitio/contenido';
import { refBordeIzquierdo } from '@/lib/sitio/portadaPartida';

export default function CabeceraSitio({ flotante = false }: { flotante?: boolean }) {
  const pathname = usePathname() || '/';
  const [desplazado, setDesplazado] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!flotante) return;
    const alDesplazar = () => setDesplazado(window.scrollY > 24);
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => window.removeEventListener('scroll', alDesplazar);
  }, [flotante]);

  const solido = !flotante || desplazado || abierto;
  // Transparente sobre la portada partida: los textos cambian de color en la raya.
  const partido = flotante && !solido;
  const refPartido = partido ? refBordeIzquierdo : undefined;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-[60] transition-all duration-300 ${
        solido
          ? 'bg-[#0b0d14]/85 backdrop-blur-xl border-b border-white/[0.07]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 h-16 flex items-center gap-6">
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
            ref={refPartido}
            className={`text-[15px] font-semibold text-white tracking-tight group-hover:text-[#c4b5fd] transition-colors ${
              partido ? 'texto-partido [--tp-a:#fff] [--tp-b:#1f1a2e] group-hover:[--tp-a:#c4b5fd] group-hover:[--tp-b:#4B2D8E]' : ''
            }`}
          >
            Grupo Corazones Cruzados
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-auto" aria-label="Principal">
          {NAVEGACION.map((n) => {
            const activo = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                ref={refPartido}
                aria-current={activo ? 'page' : undefined}
                className={`px-3 py-2 rounded-md text-[13.5px] transition-colors ${
                  activo ? 'text-white bg-white/[0.08]' : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                } ${
                  !partido ? '' : activo
                    ? 'texto-partido [--tp-a:#fff] [--tp-b:#1f1a2e]'
                    : 'texto-partido [--tp-a:rgba(255,255,255,0.6)] [--tp-b:#5b5470] hover:[--tp-a:#fff] hover:[--tp-b:#1f1a2e]'
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
          className={`lg:hidden ml-auto w-9 h-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/[0.07] ${partido ? 'menu-flotante' : ''}`}
        >
          {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {abierto && (
        <nav className="lg:hidden border-t border-white/[0.07] px-5 py-3 flex flex-col gap-1" aria-label="Principal">
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
  );
}
