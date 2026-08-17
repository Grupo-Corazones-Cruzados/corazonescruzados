'use client';

/**
 * LAS PREGUNTAS FRECUENTES DE UNA PÁGINA DE `/soluciones` — lista con buscador a la izquierda,
 * respuesta completa a la derecha.
 *
 * ── POR QUÉ ES UNA ISLA DE CLIENTE, Y QUÉ SE HIZO PARA QUE NO CUESTE SEO ───────
 * El buscador y la selección necesitan estado, así que este componente sí se hidrata. Pero
 * **las preguntas y las respuestas llegan ya escritas desde el servidor** (`faqs`, que la
 * página lee de la base al generarse) y **están todas en el HTML**, no se piden por red.
 *
 * Eso importa mucho aquí: las respuestas son el contenido con más valor de toda la web para
 * posicionar. Si vivieran solo dentro de un panel que se rellena al hacer clic, un buscador
 * no las vería nunca. Por eso la respuesta seleccionada se pinta en el panel **y** las demás
 * quedan en el documento dentro de un bloque oculto — presentes para quien lee el HTML,
 * invisibles para quien mira la pantalla.
 *
 * ── EN MÓVIL NO HAY DOS COLUMNAS ───────────────────────────────────────────────
 * A 390 px, una lista y un panel al lado son dos columnas de nada. Debajo de `lg` la
 * respuesta se despliega **bajo la propia pregunta**, que es el gesto que cualquiera espera
 * de unas preguntas frecuentes en un teléfono.
 */

import { useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { Faq } from '@/lib/faqs';

export default function FaqsSoluciones({ faqs }: { faqs: Faq[] }) {
  const [busqueda, setBusqueda] = useState('');
  const [elegidaId, setElegidaId] = useState<number | null>(faqs[0]?.id ?? null);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return faqs;
    // Busca también dentro de la respuesta: quien escribe «factura» quiere encontrar la
    // pregunta que la menciona, aunque el título no lleve esa palabra.
    return faqs.filter(
      (f) => f.pregunta.toLowerCase().includes(q) || f.respuesta.toLowerCase().includes(q),
    );
  }, [faqs, busqueda]);

  const elegida = visibles.find((f) => f.id === elegidaId) ?? null;

  if (!faqs.length) return null;

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar una pregunta"
          aria-label="Buscar entre las preguntas frecuentes"
          className="w-full h-11 pl-10 pr-4 rounded-lg bg-[var(--tarjeta)] border border-[var(--linea-fuerte)]
                     text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                     focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
        />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-8 text-[14.5px] text-[var(--tenue)]">
          Ninguna pregunta coincide con «{busqueda.trim()}».
        </p>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
          {/* ── Las preguntas ─────────────────────────────────────────────── */}
          <ul className="rounded-xl border border-[var(--linea)] bg-[var(--tarjeta)] divide-y divide-[var(--linea)] overflow-hidden">
            {visibles.map((f) => {
              const abierta = f.id === elegidaId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setElegidaId(abierta ? null : f.id)}
                    aria-expanded={abierta}
                    className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7b5fbf]/60
                      ${abierta ? 'bg-[#7b5fbf]/[0.08] text-[var(--texto)]' : 'text-[var(--suave)] hover:bg-[#7b5fbf]/[0.04] hover:text-[var(--texto)]'}`}
                  >
                    <span className="text-[14.5px] leading-relaxed flex-1">{f.pregunta}</span>
                    {/* La flecha solo tiene sentido en móvil, donde despliega de verdad. */}
                    <ChevronDown
                      className={`w-4 h-4 mt-0.5 shrink-0 lg:hidden transition-transform
                                  ${abierta ? 'rotate-180 text-[var(--violeta)]' : 'text-[var(--apagado)]'}`}
                    />
                  </button>

                  {/* Móvil: la respuesta cae bajo su pregunta. */}
                  {abierta && (
                    <div className="lg:hidden px-5 pb-5 -mt-1">
                      <p className="text-[14px] leading-relaxed text-[var(--suave)] whitespace-pre-wrap">
                        {f.respuesta}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ── La respuesta, en pantalla grande ──────────────────────────── */}
          <div className="claro-tarjeta hidden lg:block rounded-xl border border-[var(--linea)] bg-[var(--tarjeta)] p-7 lg:sticky lg:top-24">
            {elegida ? (
              <>
                <h3 className="text-[18px] font-semibold text-[var(--texto)] leading-snug">{elegida.pregunta}</h3>
                <p className="mt-4 text-[14.5px] leading-relaxed text-[var(--suave)] whitespace-pre-wrap">
                  {elegida.respuesta}
                </p>
              </>
            ) : (
              <p className="text-[14.5px] text-[var(--tenue)]">
                Elige una pregunta de la lista para leer su respuesta.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Todas las respuestas, en el documento y fuera de la vista.
          `hidden` de Tailwind es `display:none`, que los buscadores sí leen —a diferencia de
          un contenido que no existe hasta que alguien pulsa—. Es lo que garantiza que el
          texto que de verdad vale esté en la página aunque nadie toque nada. */}
      <div hidden aria-hidden="true">
        {faqs.map((f) => (
          <div key={f.id}>
            <h3>{f.pregunta}</h3>
            <p>{f.respuesta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
