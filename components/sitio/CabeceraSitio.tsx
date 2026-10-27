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
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAVEGACION } from '@/lib/sitio/contenido';

export default function CabeceraSitio({ flotante = false }: { flotante?: boolean }) {
  const pathname = usePathname() || '/';
  const [abierto, setAbierto] = useState(false);

  return (
    <header
      // `pt` = la zona de la hora y la batería del teléfono (app instalada / `viewport-fit: cover`):
      // sin él la cabecera quedaba debajo de ellas (Fernando, 2026-10-27). En el navegador vale 0.
      className="fixed top-0 inset-x-0 z-[60] pt-[var(--seguro-arriba)] bg-[#0b0d14]/85 backdrop-blur-xl border-b border-white/[0.07]"
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
            className={`text-[15px] font-semibold text-white tracking-tight group-hover:text-[#c4b5fd] transition-colors ${
              flotante ? 'md:max-[999px]:hidden' : ''
            }`}
          >
            Grupo Corazones Cruzados
          </span>
        </Link>

        <nav
          // En la portada la cápsula aparece ya desde `md` (Fernando, 2026-10-26: con su
          // ventana de ~1000 px salía la hamburguesa y «se veían perfecto» las pestañas). Entre
          // `md` y 1100 px, compacta; y por debajo de 1000 px el nombre se esconde (queda el
          // logo), o la cápsula centrada lo pisaría. La hamburguesa, solo en el teléfono.
          className={`hidden items-center gap-1 ${
            flotante
              ? 'md:flex cristal-portada absolute left-1/2 -translate-x-1/2 rounded-full p-1'
              : 'lg:flex ml-auto'
          }`}
          aria-label="Principal"
        >
          {NAVEGACION.map((n) => {
            const activo = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={activo ? 'page' : undefined}
                className={`py-2 transition-colors ${flotante ? 'rounded-full px-3 text-[13px] min-[1100px]:px-4 min-[1100px]:text-[13.5px]' : 'rounded-md px-3 text-[13.5px]'} ${
                  activo ? 'text-white bg-white/[0.1]' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
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
          className={`ml-auto w-9 h-9 inline-flex items-center justify-center text-white/80 hover:bg-white/[0.07] ${
            flotante ? 'md:hidden cristal-portada rounded-full' : 'lg:hidden rounded-md'
          }`}
        >
          {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {abierto && (
        <nav className={`${flotante ? 'md:hidden' : 'lg:hidden'} border-t border-white/[0.07] px-5 py-3 flex flex-col gap-1`} aria-label="Principal">
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
