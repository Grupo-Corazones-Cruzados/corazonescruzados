'use client';

/**
 * UNA GALERÍA HORIZONTAL DE BENEFICIOS (Fernando, 2026-11-12): las tarjetas de un grupo una al lado de
 * la otra; se desliza con el dedo o la rueda, y con las flechas ‹ › de la cabecera en escritorio. Las
 * flechas se apagan en los extremos. El desplazamiento es del carril, nunca de la página.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function GaleriaBeneficios({ titulo, icono, cuenta, children }: {
  titulo: string; icono: ReactNode; cuenta: number; children: ReactNode;
}) {
  const carril = useRef<HTMLUListElement>(null);
  const [inicio, setInicio] = useState(true);
  const [fin, setFin] = useState(false);

  const medir = () => {
    const c = carril.current; if (!c) return;
    setInicio(c.scrollLeft <= 4);
    setFin(c.scrollLeft + c.clientWidth >= c.scrollWidth - 4);
  };
  useEffect(() => {
    medir();
    const c = carril.current; if (!c) return;
    const ro = new ResizeObserver(medir); ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const mover = (dir: 1 | -1) => {
    const c = carril.current; if (!c) return;
    const paso = (c.querySelector('li')?.getBoundingClientRect().width ?? 280) + 16;
    c.scrollBy({ left: dir * paso * Math.max(1, Math.floor(c.clientWidth / paso)), behavior: 'smooth' });
  };

  return (
    <section className="galeria" aria-label={titulo}>
      <header className="galeria-cabecera">
        <span className="galeria-icono" aria-hidden>{icono}</span>
        <h3 className="galeria-titulo">{titulo}</h3>
        <span className="galeria-cuenta">{cuenta}</span>
        <div className="galeria-flechas">
          <button type="button" onClick={() => mover(-1)} disabled={inicio} aria-label={`Anteriores de ${titulo}`}><ChevronLeft /></button>
          <button type="button" onClick={() => mover(1)} disabled={fin} aria-label={`Siguientes de ${titulo}`}><ChevronRight /></button>
        </div>
      </header>
      <ul ref={carril} className="galeria-carril" onScroll={medir}>{children}</ul>
    </section>
  );
}
