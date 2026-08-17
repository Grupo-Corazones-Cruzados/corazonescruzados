'use client';

/**
 * CABECERA DEL SITIO PÚBLICO — definición ÚNICA, compartida por la portada y las páginas
 * de negocio, recursos y contacto.
 *
 * ── DOS MODOS, Y POR QUÉ ───────────────────────────────────────────────────────
 * · `flotante` — para la PORTADA. Va superpuesta y transparente, y solo se opaca al
 *   desplazar. La portada es una experiencia a pantalla completa con pixel art; una barra
 *   sólida encima le corta la cabeza a la escena.
 * · normal — para las páginas de contenido. Fija arriba, con fondo y borde.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────────
 * No lleva buscador ni menús desplegables. Cuatro destinos caben en una fila y un menú que
 * se abre para mostrar dos enlaces es un clic de más.
 *
 * Y **no lleva botón de «Crear cuenta»** (decisión de Fernando, 2026-08-02). Lo llevó, y
 * empujaba a registrarse desde la primera pantalla, antes de haber contado nada. El alta
 * sigue estando donde tiene sentido: al final de `/soluciones`, después de decir qué se hace
 * y cómo funciona el precio.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NAVEGACION } from '@/lib/sitio/contenido';

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
          <span className="text-[15px] font-semibold text-white tracking-tight group-hover:text-[#c4b5fd] transition-colors">
            Grupo Corazones Cruzados
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Principal">
          {NAVEGACION.map((n) => {
            const activo = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={activo ? 'page' : undefined}
                className={`px-3 py-2 rounded-md text-[13.5px] transition-colors ${
                  activo ? 'text-white bg-white/[0.08]' : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
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
          className="md:hidden ml-auto w-9 h-9 inline-flex items-center justify-center rounded-md text-white/80 hover:bg-white/[0.07]"
        >
          {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {abierto && (
        <nav className="md:hidden border-t border-white/[0.07] px-5 py-3 flex flex-col gap-1" aria-label="Principal">
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
