'use client';

/**
 * LAS TARJETAS PARA ELEGIR MUNDO (Fernando, 2026-10-26: «convertir esos dos en tarjetas… que
 * el usuario sepa qué tiene cada opción y se vea como un videojuego cuando eliges entre dos
 * tarjetas»).
 *
 * Sustituyen a los botones «Aventura» y «Progreso» de la portada partida. Cada tarjeta vive
 * en su mundo, junto a la raya líquida, con la MISMA forma (los botones con estilos
 * distintos «se veían raros») y el color de su lado:
 * · etiqueta de modo, icono animado, título, descripción y «▶ Elegir»;
 * · al pasar el puntero se eleva, brilla y la cruza un destello;
 * · al elegir, la elegida da un pulso de selección y la otra se desvanece; ~320 ms después
 *   se avisa (`onElegir`) y el mundo llena la pantalla.
 *
 * El icono de la Aventura son los personajes REALES del juego (`public/personajes/base`,
 * hojas de 4 vistas de 96×128): la vista de frente, con un balanceo de espera a pasos, como
 * en un videojuego. El de Progreso, un panel con barras que crecen.
 */

import { useState } from 'react';

type Mundo = 'aventura' | 'progreso';

const TEXTOS: Record<Mundo, { modo: string; titulo: string; descripcion: string }> = {
  aventura: {
    modo: 'Modo juego',
    titulo: 'Aventura',
    descripcion: 'Explora el mundo de GCC con tu personaje: misiones, retos y decisiones que te hacen crecer.',
  },
  progreso: {
    modo: 'Modo plataforma',
    titulo: 'Progreso',
    descripcion: 'Tu espacio de trabajo y desarrollo: proyectos, tareas y el avance de tu crecimiento, en un solo lugar.',
  },
};

function IconoAventura() {
  return (
    <div className="tm-icono tm-icono-aventura" aria-hidden="true">
      <span className="tm-estrella" style={{ left: '14%', top: '18%' }} />
      <span className="tm-estrella" style={{ left: '78%', top: '26%', animationDelay: '-0.8s' }} />
      <span className="tm-estrella" style={{ left: '62%', top: '12%', animationDelay: '-1.6s' }} />
      <span className="tm-suelo" />
      <span className="tm-personaje" style={{ backgroundImage: 'url(/personajes/base/hombre.png)' }} />
      <span className="tm-personaje" style={{ backgroundImage: 'url(/personajes/base/mujer.png)', animationDelay: '-0.45s' }} />
    </div>
  );
}

function IconoProgreso() {
  return (
    <div className="tm-icono tm-icono-progreso" aria-hidden="true">
      <div className="tm-panel">
        <div className="tm-barras">
          {[40, 62, 50, 82, 68, 96].map((h, i) => (
            <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.14}s` }} />
          ))}
        </div>
        <svg viewBox="0 0 120 40" className="tm-curva" preserveAspectRatio="none">
          <path d="M2 34 L24 28 L46 30 L68 18 L90 20 L118 4" />
        </svg>
      </div>
      <span className="tm-visto">
        <svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
      </span>
    </div>
  );
}

export default function TarjetasMundo({ onElegir, bloqueado }: { onElegir: (m: Mundo) => void; bloqueado?: boolean }) {
  const [eligiendo, setEligiendo] = useState<Mundo | null>(null);

  const elegir = (m: Mundo) => {
    if (bloqueado || eligiendo) return;
    setEligiendo(m);
    window.setTimeout(() => onElegir(m), 320);
  };

  const tarjeta = (m: Mundo) => {
    const t = TEXTOS[m];
    const estado = eligiendo === m ? ' tm-elegida' : eligiendo ? ' tm-descartada' : '';
    return (
      <button
        type="button"
        onClick={() => elegir(m)}
        disabled={bloqueado}
        className={`tarjeta-mundo tarjeta-mundo-${m}${estado}`}
        aria-label={`${t.titulo}: ${t.descripcion}`}
      >
        <span className="tm-destello" aria-hidden="true" />
        <span className="tm-modo">{t.modo}</span>
        {m === 'aventura' ? <IconoAventura /> : <IconoProgreso />}
        <span className="tm-titulo">{t.titulo}</span>
        <span className="tm-descripcion">{t.descripcion}</span>
        <span className="tm-elegir">
          <span aria-hidden="true">▶</span> Elegir
        </span>
      </button>
    );
  };

  return (
    <div className="cruce-rejilla">
      <div className="cruce-izquierda">{tarjeta('aventura')}</div>
      <div className="cruce-derecha">{tarjeta('progreso')}</div>
    </div>
  );
}
