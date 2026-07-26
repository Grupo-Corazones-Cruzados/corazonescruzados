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
      className="featured-thought-slot absolute left-1/2 -translate-x-1/2 w-[min(92vw,640px)] px-4 pointer-events-none"
      style={{
        top: 'calc(100% + 28px)',
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0.34s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.2s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      <div className="relative px-6 py-4">
        {/* Esquinas pixel: marcan el bloque sin encerrarlo en una caja pesada */}
        {[
          'top-0 left-0 border-t-2 border-l-2',
          'top-0 right-0 border-t-2 border-r-2',
          'bottom-0 left-0 border-b-2 border-l-2',
          'bottom-0 right-0 border-b-2 border-r-2',
        ].map((pos) => (
          <span key={pos} className={`absolute ${pos} w-3 h-3`} style={{ borderColor: 'var(--color-accent-glow)', opacity: 0.55 }} />
        ))}

        <p
          className="mb-2.5"
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.55rem',
            letterSpacing: '0.22em',
            color: 'var(--color-accent-glow)',
            opacity: 0.85,
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
              {data.content.slice(0, shown)}
              {escribiendo && (
                <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>
              )}
            </p>

            <p
              className="mt-2"
              style={{
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.5rem',
                letterSpacing: '0.16em',
                color: '#64748b',
              }}
            >
              {fecha.toUpperCase()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
