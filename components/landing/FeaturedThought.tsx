'use client';

import { useEffect, useState } from 'react';

interface Featured { content: string; createdAt: string }

/**
 * Pensamiento destacado en la portada, colgando POR DEBAJO del bloque central.
 *
 * El administrador elige uno de sus pensamientos desde el módulo Pensamientos y aparece
 * aquí para cualquier visitante (`GET /api/pensamientos/destacado` es público y solo
 * devuelve el texto y la fecha).
 *
 * SIN SALTOS: va **absoluto** bajo el bloque central (`top: calc(100% + 28px)`), así que
 * NO ocupa sitio en el flujo. El distintivo, el título, el subtítulo y los botones se
 * quedan centrados y quietos, aparezca el pensamiento cuando aparezca. Mientras llega la
 * respuesta se muestra un cargador, para que su aparición se sienta esperada y no un
 * parpadeo. Si no hay ninguno publicado, no se pinta nada.
 */
export default function FeaturedThought({ windAway = false }: { windAway?: boolean }) {
  const [data, setData] = useState<Featured | null>(null);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(0);   // caracteres ya "escritos"

  useEffect(() => {
    let alive = true;
    fetch('/api/pensamientos/destacado')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.data?.content) setData(j.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Máquina de escribir: ~20 ms por carácter, y se salta si el usuario prefiere menos
  // movimiento. Al terminar deja el texto completo, nunca a medias.
  useEffect(() => {
    if (!data) return;
    const full = data.content.length;
    const sinMovimiento = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (sinMovimiento) { setShown(full); return; }
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= full) { clearInterval(id); return full; }
        return n + 1;
      });
    }, 20);
    return () => clearInterval(id);
  }, [data]);

  const fecha = data
    ? new Date(data.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const escribiendo = !!data && shown < data.content.length;

  return (
    <div
      className="featured-thought-slot max-sm:[--hueco-pensamiento:52px] absolute left-1/2 -translate-x-1/2 w-[min(92vw,640px)] px-4 pointer-events-none"
      style={{
        // Deja sitio al borde inferior de la placa del titular (~40 px en `sm`, 32 en el teléfono).
        top: 'calc(100% + var(--hueco-pensamiento, 64px))',
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0.34s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.2s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      <div className="relative px-7 py-5">
        {/* Placa pixel de la portada partida (2026-10-26): el pensamiento cruza la raya
            Aventura | Progreso y así se lee igual sobre el cielo y sobre el claro. Sustituye
            a las cuatro escuadras sueltas, que junto a la placa del titular chocaban. */}
        <span aria-hidden="true" className="placa-pixel placa-pixel-fina cristal-portada absolute inset-0 -z-10" />
        <p
          className="mb-2.5"
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.55rem',
            letterSpacing: '0.22em',
            // Antes era el morado de marca al 85 %: sobre el fondo negro quedaba apagado y
            // la etiqueta se perdía. Este lila claro ya se usa en el resto de la portada
            // para texto secundario, así que sube el contraste sin salirse de la paleta.
            color: '#a78bfa',
            opacity: 1,
          }}
        >
          PENSAMIENTO
        </p>

        {loading ? (
          // Cargador: tres bloques pixel latiendo. Ocupa el sitio del texto, así que al
          // llegar el pensamiento no hay ningún reajuste.
          <span className="flex items-center gap-1.5" role="status" aria-label="Cargando pensamiento">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 6, height: 6, display: 'inline-block',
                  background: 'var(--color-accent-glow)',
                  animation: `thoughtDot 1.1s ease-in-out ${i * 0.16}s infinite`,
                }}
              />
            ))}
          </span>
        ) : data ? (
          <>
            <p
              className="featured-thought-text whitespace-pre-wrap"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.9rem',
                lineHeight: 1.75,
                color: '#cbd5e1',
                textShadow: '0 0 18px rgba(123, 95, 191, 0.18)',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',   // el nº de líneas lo pone `.featured-thought-text`
              }}
            >
              <span className="comilla-pensamiento" aria-hidden="true">“</span>
              {data.content.slice(0, shown)}
              {escribiendo && (
                <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>
              )}
              {!escribiendo && <span className="comilla-pensamiento" aria-hidden="true">”</span>}
            </p>

            <p
              className="mt-2"
              style={{
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.5rem',
                letterSpacing: '0.16em',
                color: '#8b84a8',
              }}
            >
              — {fecha.toUpperCase()} —
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
