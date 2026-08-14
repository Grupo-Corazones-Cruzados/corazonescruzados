'use client';

/**
 * Índice de secciones del CV público, con la sección en pantalla marcada sola.
 *
 * ── SIN JAVASCRIPT SIGUE SIRVIENDO ────────────────────────────────────────────
 * Son anclas de verdad (`<a href="#talentos">`), renderizadas en el servidor. El
 * script solo añade la MARCA de en cuál estás. Si no se ejecuta, el índice navega
 * igual: lo que se pierde es el resalte, no la navegación.
 *
 * ── POR QUÉ IntersectionObserver Y NO ESCUCHAR EL SCROLL ──────────────────────
 * Un `onscroll` que mide posiciones corre en cada fotograma y obliga al navegador a
 * recalcular la maqueta. El observador avisa solo cuando algo cruza el umbral.
 */
import { useEffect, useState } from 'react';

export interface Seccion { id: string; label: string }

export default function IndiceSecciones({
  secciones,
  className = '',
  orientacion = 'vertical',
}: {
  secciones: Seccion[];
  className?: string;
  orientacion?: 'vertical' | 'horizontal';
}) {
  const [activa, setActiva] = useState(secciones[0]?.id ?? '');

  useEffect(() => {
    const nodos = secciones
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => !!n);
    if (!nodos.length) return;

    const obs = new IntersectionObserver(
      (entradas) => {
        // La sección activa es la más alta de las que están dentro de la banda:
        // quedarse con «la última que entró» hace que al subir se marque la de
        // abajo, que es justo la que se acaba de dejar.
        const visibles = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visibles[0]) setActiva(visibles[0].target.id);
      },
      // Banda estrecha en el tercio superior: marca la sección que se está leyendo,
      // no la que asoma por el borde inferior.
      { rootMargin: '-12% 0px -68% 0px', threshold: 0 },
    );
    nodos.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [secciones]);

  const vertical = orientacion === 'vertical';

  return (
    <nav
      aria-label="Secciones del currículum"
      className={`cv-indice ${vertical ? 'cv-indice-v flex flex-col gap-1' : 'cv-indice-h flex gap-1.5 overflow-x-auto'} ${className}`}
    >
      {secciones.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          data-activo={activa === s.id ? 'si' : 'no'}
          className={`whitespace-nowrap text-[12.5px] text-white/45 hover:text-white/80 ${
            vertical ? 'pl-3 py-1' : 'px-3 py-1.5 rounded-full border border-white/10'
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
