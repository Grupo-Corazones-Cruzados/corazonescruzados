'use client';

import { useEffect, useState } from 'react';

interface Featured { content: string; createdAt: string }

/**
 * Pensamiento destacado en la portada.
 *
 * El administrador elige uno de sus pensamientos desde el módulo Pensamientos y aparece
 * aquí para cualquier visitante (`GET /api/pensamientos/destacado` es público y solo
 * devuelve el texto y la fecha).
 *
 * Estética: una "transmisión" pixelart — marco de esquinas, kicker en Silkscreen y el
 * texto escribiéndose a máquina. Si no hay nada publicado, o si falla la petición, no
 * renderiza nada: la portada nunca depende de esto.
 */
export default function FeaturedThought({ windAway = false }: { windAway?: boolean }) {
  const [data, setData] = useState<Featured | null>(null);
  const [shown, setShown] = useState(0);   // caracteres ya "escritos"

  useEffect(() => {
    let alive = true;
    fetch('/api/pensamientos/destacado')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.data?.content) setData(j.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Máquina de escribir: ~22 ms por carácter, y se salta si el usuario prefiere menos
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
    }, 22);
    return () => clearInterval(id);
  }, [data]);

  if (!data) return null;

  const fecha = new Date(data.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const escribiendo = shown < data.content.length;

  return (
    <div
      className="mt-12 w-full max-w-[640px] px-4"
      style={{
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0.34s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.35s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      <div className="relative px-6 py-5">
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

        <p
          className="whitespace-pre-wrap"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.9rem',
            lineHeight: 1.75,
            color: '#cbd5e1',
            textShadow: '0 0 18px rgba(123, 95, 191, 0.18)',
          }}
        >
          {data.content.slice(0, shown)}
          {escribiendo && (
            <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>
          )}
        </p>

        <p
          className="mt-3"
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.5rem',
            letterSpacing: '0.16em',
            color: '#64748b',
          }}
        >
          {fecha.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
