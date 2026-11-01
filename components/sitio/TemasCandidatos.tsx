'use client';

/**
 * LOS APARTADOS DEL FORMULARIO DE POSTULACIÓN, COMO UN RECORRIDO — la página Candidatos (Fernando,
 * 2026-11-01: «lo mismo que tiene el formulario de postulación pero en orden para ir revisando todo
 * el contenido desde esta página»).
 *
 * Son siete: en una fila de pestañas no cabían (Fernando: «son muchas, se ve súper mal»). Por eso es
 * el CAMINO del formulario: a la izquierda los pasos numerados unidos por una línea, fijos al
 * desplazar; a la derecha el apartado elegido y, al pie, Anterior / Siguiente para leerlo en orden.
 * En el teléfono y la tableta el camino es un desplegable a todo el ancho (regla de `/diseno`).
 *
 * El contenido es **el mismo componente** que pinta el formulario (`SLIDES` de
 * `OnboardingSlidersModal`): cambiar un texto allí lo cambia aquí. Cada apartado tiene su URL
 * (`/candidatos/<apartado>`), que se reescribe con `replaceState` al cambiar.
 */

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SLIDES } from '@/components/landing/OnboardingSlidersModal';

const dos = (n: number) => String(n).padStart(2, '0');

export default function TemasCandidatos({ inicial }: { inicial: string }) {
  const [activa, setActiva] = useState(() => Math.max(0, SLIDES.findIndex((s) => s.id === inicial)));
  const [dir, setDir] = useState<'der' | 'izq' | null>(null);
  const arriba = useRef<HTMLElement>(null);
  const paso = SLIDES[activa];
  const { Component } = paso;

  const ir = (j: number, subir = false) => {
    if (j === activa || j < 0 || j >= SLIDES.length) return;
    setDir(j > activa ? 'der' : 'izq');
    setActiva(j);
    window.history.replaceState(null, '', `/candidatos/${SLIDES[j].id}`);
    if (subir) arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section ref={arriba} className="recorrido scroll-mt-24" aria-label="Apartados de la postulación">
      <label className="segmentado-movil recorrido-select">
        <span className="sr-only">Apartado</span>
        <select value={paso.id} onChange={(e) => ir(SLIDES.findIndex((s) => s.id === e.target.value))}>
          {SLIDES.map((s, j) => <option key={s.id} value={s.id}>{dos(j + 1)} · {s.title}</option>)}
        </select>
      </label>

      <nav className="recorrido-camino" aria-label="Apartados">
        <ol>
          {SLIDES.map((s, j) => {
            const Icon = s.Icon;
            return (
              <li key={s.id}>
                <button type="button" onClick={() => ir(j)} aria-current={j === activa ? 'step' : undefined}
                  className="recorrido-nodo" data-hecho={j < activa ? '' : undefined}>
                  <span className="recorrido-nodo-punto" aria-hidden><Icon className="h-4 w-4" /></span>
                  <span className="recorrido-nodo-texto">
                    <span className="recorrido-nodo-num">{dos(j + 1)}</span>
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <article key={paso.id} className="recorrido-paso" data-dir={dir ?? undefined}>
        <header className="recorrido-cabecera">
          <p className="recorrido-cuenta">{dos(activa + 1)} / {dos(SLIDES.length)}</p>
          {/* El `<h1>` de la página es el apartado abierto: cada URL, su título. */}
          <h1 className="recorrido-titulo">{paso.title}</h1>
        </header>
        <div className="paso-candidato"><Component /></div>
        <footer className="recorrido-pie">
          {activa > 0 ? (
            <button type="button" onClick={() => ir(activa - 1, true)} className="recorrido-boton">
              <ArrowLeft aria-hidden /> <span><small>Anterior</small>{SLIDES[activa - 1].title}</span>
            </button>
          ) : <span />}
          {activa < SLIDES.length - 1 && (
            <button type="button" onClick={() => ir(activa + 1, true)} className="recorrido-boton es-siguiente">
              <span><small>Siguiente</small>{SLIDES[activa + 1].title}</span> <ArrowRight aria-hidden />
            </button>
          )}
        </footer>
      </article>
    </section>
  );
}
