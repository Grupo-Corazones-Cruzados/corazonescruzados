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
 * POSICIÓN: se monta dentro del bloque central del hero pero **absoluto sobre él**
 * (`bottom: 100%`), encima del distintivo "Grupo Corazones Cruzados". Al no ocupar sitio
 * en el flujo, llegue cuando llegue **no empuja nada**: el título y los botones quedan
 * clavados desde el primer pintado. Antes iba debajo de los botones y, al cargar, subía
 * toda la portada de golpe.
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

  if (!data) return null;

  const fecha = new Date(data.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const escribiendo = shown < data.content.length;

  return (
    <div
      // Fuera del flujo: no desplaza el hero. `pointer-events-none` para no tapar clics.
      className="absolute left-1/2 -translate-x-1/2 w-[min(92vw,620px)] pointer-events-none"
      style={{
        bottom: 'calc(100% + 14px)',
        animation: windAway
          ? 'windBlowAway 1.2s ease-in 0s forwards'
          : 'featuredThoughtIn 0.9s ease-out 0.15s both',
        willChange: 'transform, opacity, filter',
      }}
    >
      <div
        className="featured-thought-panel relative px-6 py-5 rounded-lg"
        style={{
          // Panel tenue con halo: destaca sobre el fondo negro sin competir con el título.
          background: 'linear-gradient(180deg, rgba(75,45,142,0.20) 0%, rgba(75,45,142,0.06) 100%)',
          border: '1px solid rgba(123,95,191,0.45)',
          boxShadow: '0 0 40px rgba(75,45,142,0.28), inset 0 0 30px rgba(123,95,191,0.08)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* Esquinas pixel: refuerzan el marco sin encerrarlo */}
        {[
          'top-0 left-0 border-t-2 border-l-2',
          'top-0 right-0 border-t-2 border-r-2',
          'bottom-0 left-0 border-b-2 border-l-2',
          'bottom-0 right-0 border-b-2 border-r-2',
        ].map((pos) => (
          <span key={pos} className={`absolute ${pos} w-3.5 h-3.5`} style={{ borderColor: 'var(--color-accent-glow)' }} />
        ))}

        <p
          className="mb-3"
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.6rem',
            letterSpacing: '0.24em',
            color: 'var(--color-accent-glow)',
            textShadow: '0 0 12px rgba(123,95,191,0.7)',
          }}
        >
          PENSAMIENTO
        </p>

        <p
          className="featured-thought-text whitespace-pre-wrap"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '1rem',
            lineHeight: 1.7,
            color: '#f1eaff',
            textShadow: '0 0 22px rgba(123,95,191,0.45)',
            // Tope de 4 líneas: al ir ARRIBA del bloque central, el espacio disponible es
            // el hueco sobre el hero. Un pensamiento largo se saldría de la pantalla en
            // portátiles bajos, así que aquí se recorta (el texto completo vive en el módulo).
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',   // el nº de líneas lo pone `.featured-thought-text` (globals.css)
          }}
        >
          {data.content.slice(0, shown)}
          {escribiendo && (
            <span style={{ color: 'var(--color-accent-glow)', animation: 'thoughtCaret 0.9s steps(1) infinite' }}>▌</span>
          )}
        </p>

        <p
          className="featured-thought-date mt-3"
          style={{
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.5rem',
            letterSpacing: '0.16em',
            color: 'rgba(203,213,225,0.55)',
          }}
        >
          {fecha.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
