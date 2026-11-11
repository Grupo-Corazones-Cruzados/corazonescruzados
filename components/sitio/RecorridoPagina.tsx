'use client';

/**
 * EL RECORRIDO DE UNA PÁGINA DEL SITIO — Candidatos (2026-11-01) y Clientes (2026-11-11), la misma pieza.
 *
 * Son varios apartados: en una fila de pestañas no cabían (Fernando: «son muchas, se ve súper mal»).
 * Por eso es un CAMINO: a la izquierda los pasos numerados unidos por una línea, fijos al desplazar; a
 * la derecha el apartado elegido y, al pie, Anterior / Siguiente para leerlo en orden. En el teléfono y
 * la tableta el camino es un desplegable a todo el ancho (regla de `/diseno`). Cada apartado tiene su URL
 * (`<base>/<apartado>`), que se reescribe con `replaceState` al cambiar.
 */

import { useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface PasoRecorrido {
  id: string;
  title: string;
  /** El icono del nodo del camino, ya pintado (`h-4 w-4`). */
  icono: ReactNode;
  /** Lo que se enseña al abrir el apartado. */
  contenido: ReactNode;
}

const dos = (n: number) => String(n).padStart(2, '0');

export default function RecorridoPagina({
  pasos, inicial, base, etiqueta,
}: {
  pasos: PasoRecorrido[];
  inicial: string;
  /** La ruta de la que cuelgan los apartados (`/candidatos`, `/clientes`). */
  base: string;
  etiqueta: string;
}) {
  const [activa, setActiva] = useState(() => Math.max(0, pasos.findIndex((s) => s.id === inicial)));
  const [dir, setDir] = useState<'der' | 'izq' | null>(null);
  const arriba = useRef<HTMLElement>(null);
  const paso = pasos[activa];

  const ir = (j: number, subir = false) => {
    if (j === activa || j < 0 || j >= pasos.length) return;
    setDir(j > activa ? 'der' : 'izq');
    setActiva(j);
    window.history.replaceState(null, '', `${base}/${pasos[j].id}`);
    if (subir) arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section ref={arriba} className="recorrido scroll-mt-24" aria-label={etiqueta}>
      <label className="segmentado-movil recorrido-select">
        <span className="sr-only">Apartado</span>
        <select value={paso.id} onChange={(e) => ir(pasos.findIndex((s) => s.id === e.target.value))}>
          {pasos.map((s, j) => <option key={s.id} value={s.id}>{dos(j + 1)} · {s.title}</option>)}
        </select>
      </label>

      <nav className="recorrido-camino" aria-label="Apartados">
        <ol>
          {pasos.map((s, j) => (
            <li key={s.id}>
              <button type="button" onClick={() => ir(j)} aria-current={j === activa ? 'step' : undefined}
                className="recorrido-nodo" data-hecho={j < activa ? '' : undefined}>
                <span className="recorrido-nodo-punto" aria-hidden>{s.icono}</span>
                <span className="recorrido-nodo-texto">
                  <span className="recorrido-nodo-num">{dos(j + 1)}</span>
                  {s.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <article key={paso.id} className="recorrido-paso" data-dir={dir ?? undefined}>
        <header className="recorrido-cabecera">
          <p className="recorrido-cuenta">{dos(activa + 1)} / {dos(pasos.length)}</p>
          {/* El `<h1>` de la página es el apartado abierto: cada URL, su título. */}
          <h1 className="recorrido-titulo">{paso.title}</h1>
        </header>
        {paso.contenido}
        <footer className="recorrido-pie">
          {activa > 0 ? (
            <button type="button" onClick={() => ir(activa - 1, true)} className="recorrido-boton">
              <ArrowLeft aria-hidden /> <span><small>Anterior</small>{pasos[activa - 1].title}</span>
            </button>
          ) : <span />}
          {activa < pasos.length - 1 && (
            <button type="button" onClick={() => ir(activa + 1, true)} className="recorrido-boton es-siguiente">
              <span><small>Siguiente</small>{pasos[activa + 1].title}</span> <ArrowRight aria-hidden />
            </button>
          )}
        </footer>
      </article>
    </section>
  );
}
