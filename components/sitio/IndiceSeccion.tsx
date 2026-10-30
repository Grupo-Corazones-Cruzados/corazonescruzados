'use client';

/**
 * «EN ESTA PÁGINA» — el índice de preguntas de la derecha, que SIGUE la lectura (2026-10-30).
 *
 * Fernando: *«la parte de en esta página no se ve»*. Era una lista de texto gris suelta sobre el
 * fondo, que se confundía con él. Ahora es una tarjeta (la misma familia que las puertas), con
 * las preguntas numeradas, y marca la que se está leyendo: una barra violeta y el texto oscuro.
 *
 * Sigue siendo una lista de `<a href="#…">` que viaja en el HTML: el componente solo AÑADE la
 * marca de la pregunta activa. Un buscador ve lo mismo que antes.
 *
 * La activa es la última pregunta cuyo comienzo ya pasó del 35 % alto de la pantalla; antes de
 * la primera, ninguna. Se mide al desplazar (la página se desplaza en la ventana, no en el `main`).
 */

import { useEffect, useState } from 'react';
import type { Acceso } from '@/lib/sitio/contenido';

export default function IndiceSeccion({ temas }: { temas: NonNullable<Acceso['temas']> }) {
  const [activa, setActiva] = useState<string | null>(null);

  useEffect(() => {
    const els = temas.map((t) => document.getElementById(t.id)).filter((e): e is HTMLElement => !!e);
    let marco = 0;
    const medir = () => {
      marco = 0;
      const linea = window.innerHeight * 0.35;
      let actual: string | null = null;
      for (const el of els) if (el.getBoundingClientRect().top <= linea) actual = el.id;
      setActiva(actual);
    };
    const alDesplazar = () => { if (!marco) marco = requestAnimationFrame(medir); };
    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
      if (marco) cancelAnimationFrame(marco);
    };
  }, [temas]);

  return (
    <aside aria-label="Preguntas de esta sección" className="indice-tarjeta">
      <p className="indice-tarjeta-rotulo">En esta página</p>
      <ol>
        {temas.map((t, i) => {
          const es = activa === t.id;
          return (
            <li key={t.id}>
              <a href={`#${t.id}`} className={`indice-tarjeta-enlace ${es ? 'es-activa' : ''}`} aria-current={es ? 'location' : undefined}>
                <span className="indice-tarjeta-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className="indice-tarjeta-etiqueta">{t.etiqueta}</span>
                  <span className="indice-tarjeta-pregunta">{t.pregunta}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
