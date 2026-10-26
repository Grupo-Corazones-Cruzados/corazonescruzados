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
      className="featured-thought-slot relative mx-auto w-[min(92vw,620px)] pointer-events-none"
      style={{
        marginTop: 'clamp(24px, 6vh, 60px)',
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0.34s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.2s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      {/* «El cruce» (2026-10-26): cápsula de cristal sobre la raya, como las pestañas. */}
      <div className="cristal-portada relative rounded-2xl px-7 py-4">
        <p
          className="mb-2"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.66rem',
            fontWeight: 600,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            // Antes era el morado de marca al 85 %: sobre el fondo negro quedaba apagado y
            // la etiqueta se perdía. Este lila claro ya se usa en el resto de la portada
            // para texto secundario, así que sube el contraste sin salirse de la paleta.
            color: '#a78bfa',
            opacity: 1,
          }}
        >
          Pensamiento
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
                // Iteración 2 (2026-10-26): la serif cursiva del titular, no la monoespaciada.
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 'clamp(1.15rem, 2.4vh, 1.45rem)',
                lineHeight: 1.45,
                color: '#e7e3f4',
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
              className="mt-1.5"
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '0.68rem',
                fontWeight: 500,
                letterSpacing: '0.12em',
                color: '#8b84a8',
              }}
            >
              {fecha}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
