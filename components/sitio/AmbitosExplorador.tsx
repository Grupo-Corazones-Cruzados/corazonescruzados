'use client';

/**
 * EL EXPLORADOR DE `/ambitos` — carpetas a la izquierda, trabajo a la derecha.
 *
 * Fernando lo pidió «al estilo de legal y privacidad»: un panel izquierdo con el listado, y
 * el contenido al lado. Cada **ámbito** es una carpeta que se despliega y enseña sus
 * **talentos**; al elegir un talento, a la derecha salen los proyectos y tickets terminados
 * que se hicieron con él.
 *
 * ── ⭐ TODO EL CONTENIDO ESTÁ EN EL HTML, TAMBIÉN LO QUE NO SE VE ──────────────
 * Los paneles de los talentos NO elegidos se pintan igualmente, dentro de un bloque
 * `hidden`. Es exactamente el remedio que ya se usó dos veces en este proyecto:
 *  · las respuestas de las preguntas frecuentes, que es lo que permite declarar `FAQPage`;
 *  · las descripciones de `VentanaTarjeta`, donde se midió que **lo que solo viaja como
 *    prop a un componente de cliente no existe para el buscador** (aparecía 1 vez en el
 *    HTML, dentro del `<script>` de hidratación, y 0 en el marcado visible).
 *
 * Aquí es lo que de verdad puede posicionar la página: once proyectos con su descripción y
 * sus etiquetas. Si solo se pintara el talento abierto, Google vería uno y se perdería diez.
 *
 * ── POR QUÉ ES COMPONENTE DE CLIENTE ──────────────────────────────────────────
 * Desplegar carpetas y cambiar de talento es estado. Los datos llegan **ya resueltos** desde
 * el servidor: aquí no se pide nada por red.
 */

import { useState } from 'react';
import { ChevronRight, Folder, FolderOpen } from 'lucide-react';
import type { Ambito, Trabajo } from '@/lib/ambitos';
import TarjetaTrabajo from './TarjetaTrabajo';

export interface AmbitoConTrabajo extends Ambito {
  /** El trabajo de cada talento, ya consultado en el servidor. */
  trabajoPorTalento: Record<string, Trabajo[]>;
}

export default function AmbitosExplorador({ ambitos }: { ambitos: AmbitoConTrabajo[] }) {
  // Abre el primer ámbito y su primer talento: una página que arranca con todo cerrado
  // obliga a adivinar que hay que pulsar algo.
  const primero = ambitos[0];
  const [abiertos, setAbiertos] = useState<Set<number>>(new Set(primero ? [primero.id] : []));
  const [elegido, setElegido] = useState<string | null>(primero?.talentos[0] ?? null);

  const alternar = (id: number) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const trabajoElegido: Trabajo[] = elegido
    ? ambitos.flatMap((a) => a.trabajoPorTalento[elegido] ?? []).filter(
        // Un talento puede estar en dos ámbitos a propósito; su trabajo es el mismo, así que
        // se quitan los repetidos por tipo+id.
        (t, i, arr) => arr.findIndex((x) => x.tipo === t.tipo && x.id === t.id) === i,
      )
    : [];

  if (ambitos.length === 0) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* ── EL PANEL IZQUIERDO ─────────────────────────────────────────────────── */}
      <nav aria-label="Ámbitos" className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
          Ámbitos
        </p>
        <ul className="space-y-0.5">
          {ambitos.map((a) => {
            const abierto = abiertos.has(a.id);
            return (
              <li key={a.id} id={a.slug} className="scroll-mt-24">
                <button
                  type="button"
                  onClick={() => alternar(a.id)}
                  aria-expanded={abierto}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors
                             hover:bg-[#7b5fbf]/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50"
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 text-[var(--tenue)] transition-transform ${abierto ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  {abierto
                    ? <FolderOpen className="w-4 h-4 shrink-0 text-[var(--violeta-txt)]" aria-hidden />
                    : <Folder className="w-4 h-4 shrink-0 text-[var(--tenue)]" aria-hidden />}
                  <span className="text-[14px] font-medium text-[var(--texto)] leading-snug">{a.nombre}</span>
                </button>

                {abierto && (
                  <ul className="ml-[26px] border-l border-[var(--linea)] pl-2.5 py-0.5 space-y-0.5">
                    {a.talentos.map((t) => {
                      const activo = t === elegido;
                      const cuantos = (a.trabajoPorTalento[t] ?? []).length;
                      return (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => setElegido(t)}
                            aria-current={activo ? 'true' : undefined}
                            className={`w-full flex items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition-colors
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50
                              ${activo
                                ? 'bg-[#7b5fbf]/[0.09] text-[var(--violeta-txt)] font-medium'
                                : 'text-[var(--suave)] hover:bg-[#7b5fbf]/[0.05] hover:text-[var(--texto)]'}`}
                          >
                            <span className="text-[13px] leading-snug flex-1">{t}</span>
                            <span className="text-[11px] text-[var(--apagado)] tabular-nums">{cuantos}</span>
                          </button>
                        </li>
                      );
                    })}
                    {a.talentos.length === 0 && (
                      <li className="px-2 py-1.5 text-[12.5px] text-[var(--apagado)]">Sin talentos todavía.</li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── EL PANEL DERECHO ───────────────────────────────────────────────────── */}
      <div>
        {elegido && (
          <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-[var(--texto)] mb-1">
            {elegido}
          </h2>
        )}
        <p className="text-[13.5px] text-[var(--tenue)] mb-6">
          {trabajoElegido.length === 0
            ? 'Todavía no hay trabajo publicado con este talento.'
            : `${trabajoElegido.length} ${trabajoElegido.length === 1 ? 'trabajo terminado' : 'trabajos terminados'}`}
        </p>

        {trabajoElegido.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {trabajoElegido.map((t) => (
              <TarjetaTrabajo key={`${t.tipo}-${t.id}`} trabajo={t} />
            ))}
          </div>
        )}

        {/* ⭐ EL RESTO DEL CONTENIDO, PARA QUIEN NO PULSA NADA — un buscador, sobre todo.
            Se pinta como nodos de verdad y se oculta con `hidden`, que NO lo saca del HTML.
            Sin esto, de once proyectos Google vería solo el del talento abierto. */}
        <div hidden aria-hidden="true">
          {ambitos.map((a) =>
            a.talentos.map((t) => {
              if (t === elegido) return null;
              return (
                <section key={`${a.id}-${t}`}>
                  <h3>{a.nombre} · {t}</h3>
                  {(a.trabajoPorTalento[t] ?? []).map((w) => (
                    <article key={`${w.tipo}-${w.id}`}>
                      <h4>{w.titulo}</h4>
                      {w.descripcion && <p>{w.descripcion}</p>}
                      {w.etiquetas.length > 0 && <p>{w.etiquetas.join(', ')}</p>}
                    </article>
                  ))}
                </section>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
