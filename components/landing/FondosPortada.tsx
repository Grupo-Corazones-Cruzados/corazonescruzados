/**
 * LOS DOS MUNDOS DE LA PORTADA (Fernando, 2026-10-26).
 *
 * Va DENTRO del héroe, encima del cielo estrellado (que sigue siendo el de siempre, con su
 * cámara) y debajo de las esquinas de cámara y del titular. Pinta tres cosas:
 *
 * · **La Aventura** — sobre el mismo cielo, una nebulosa suave y, desde `xl`, un HUD de
 *   videojuego en pixel-art (Misión, Vida, Nivel a la izquierda; Mapa, Tesoros, Compañeros a
 *   la derecha), en espejo con las tarjetas de Progreso para que los dos lados pesen igual.
 *   Con «Aventura» la nebulosa se intensifica y pasan estrellas fugaces. Al empezar el juego
 *   (`juegoEnCurso`) todo esto se va: la intro tiene su propio cielo.
 * · **La escena de Progreso** — la Plataforma en claro: fondo claro con malla de puntos,
 *   manchas de color que flotan, cuadraditos que suben y, desde `xl`, tarjetas de panel que
 *   se animan (barras, anillo, lista, gráfica, nivel). Ocupa la pantalla entera y se RECORTA
 *   con `--corte`: en reposo se ve la mitad derecha; con «Progreso», toda.
 * · **La raya** — en `--corte`. Solo se ve con la pantalla partida.
 *
 * Todo es decorativo (`aria-hidden`, sin eventos). El movimiento se apaga con «reducir
 * movimiento» (`globals.css`).
 */

import type { ModoPortada } from '@/lib/sitio/portadaPartida';

const BARRAS = [38, 62, 48, 80, 56, 92, 70];
const TAREAS = ['Revisar avances', 'Reunión del equipo', 'Cerrar el ciclo'];

// Cuadraditos que suben: posición horizontal (%), tamaño (px), duración y retraso (s).
const BURBUJAS: Array<[number, number, number, number]> = [
  [6, 10, 19, 0], [14, 6, 15, 4], [23, 8, 21, 9], [31, 12, 24, 2], [39, 6, 17, 12],
  [47, 9, 22, 6], [55, 7, 16, 1], [62, 11, 23, 10], [70, 6, 18, 3], [77, 10, 20, 8],
  [85, 7, 15, 5], [92, 12, 25, 11],
];

// Corazón pixel 7×6 (1 = relleno).
const CORAZON = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

function CorazonPixel({ lleno, className }: { lleno: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 7 6" shapeRendering="crispEdges" className={className} width="21" height="18">
      {CORAZON.flatMap((fila, y) =>
        [...fila].map((c, x) =>
          c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={lleno ? '#ef4444' : 'rgba(255,255,255,0.14)'} /> : null,
        ),
      )}
    </svg>
  );
}

export default function FondosPortada({ modo, juegoEnCurso }: { modo: ModoPortada; juegoEnCurso: boolean }) {
  const aventura = modo === 'aventura' && !juegoEnCurso;
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
      {/* ── Aventura: lo que se suma al cielo ── */}
      <div className="escena-aventura absolute inset-0" style={{ opacity: juegoEnCurso ? 0 : 1 }}>
        <div className="ea-nebulosas absolute inset-0" style={{ opacity: aventura ? 1 : 0.5 }}>
          <div className="ea-nebulosa ea-nebulosa-1" />
          <div className="ea-nebulosa ea-nebulosa-2" />
        </div>
        <div className="absolute inset-0 transition-opacity duration-700" style={{ opacity: aventura ? 1 : 0 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`ea-fugaz ea-fugaz-${i}`} />
          ))}
        </div>

        <div className="hidden xl:block">
          {/* Izquierda: se ven con la pantalla partida. */}
          <div className="ea-hud ep-flota" style={{ left: '6%', top: '13%', animationDelay: '-2s' }}>
            <p className="ea-titulo">Misión</p>
            <p className="ea-texto mt-2">Proteger el mundo</p>
            <div className="ea-segmentos mt-2.5">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.35}s` }} />
              ))}
            </div>
          </div>

          <div className="ea-hud ep-flota" style={{ left: '9%', top: '54%', animationDelay: '-5s' }}>
            <p className="ea-titulo">Vida</p>
            <div className="mt-2.5 flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <CorazonPixel key={i} lleno={i < 4} className={i === 3 ? 'ea-latido' : undefined} />
              ))}
            </div>
          </div>

          <div className="ea-hud ea-pastilla ep-flota" style={{ left: '5%', top: '80%', animationDelay: '-3.5s' }}>
            <span className="ea-estrella">★</span>
            <span className="ea-texto">Nv. 1 · Explorador</span>
          </div>

          {/* Derecha: se ven al llenarse la pantalla con «Aventura». */}
          <div className="ea-hud ep-flota" style={{ right: '6%', top: '13%', animationDelay: '-1s' }}>
            <p className="ea-titulo">Mapa</p>
            <div className="ea-mapa mt-2.5">
              <span className="ea-mapa-yo" />
              <span className="ea-mapa-meta" />
            </div>
          </div>

          <div className="ea-hud ep-flota" style={{ right: '9%', top: '54%', animationDelay: '-4s' }}>
            <p className="ea-titulo">Tesoros</p>
            <div className="mt-2.5 flex items-center gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`ea-gema ${i < 3 ? 'ea-gema-llena' : ''}`} style={{ animationDelay: `${i * 0.3}s` }} />
              ))}
              <span className="ea-texto ml-1">3/5</span>
            </div>
          </div>

          <div className="ea-hud ea-pastilla ep-flota" style={{ right: '5%', top: '80%', animationDelay: '-2.5s' }}>
            <span className="ea-enlinea" />
            <span className="ea-texto">3 compañeros en línea</span>
          </div>
        </div>
      </div>

      {/* ── Progreso: la Plataforma en claro, recortada por la raya ── */}
      <div className="escena-progreso absolute inset-0">
        <div className="ep-puntos absolute inset-0" />
        <div className="ep-mancha ep-mancha-1" />
        <div className="ep-mancha ep-mancha-2" />
        <div className="ep-mancha ep-mancha-3" />
        {BURBUJAS.map(([x, t, d, r], i) => (
          <span
            key={i}
            className="ep-burbuja"
            style={{ left: `${x}%`, width: t, height: t, animationDuration: `${d}s`, animationDelay: `-${r}s` }}
          />
        ))}

        <div className="hidden xl:block">
          {/* Izquierda: se ven al llenarse la pantalla con «Progreso». */}
          <div className="ep-tarjeta ep-flota" style={{ left: '6%', top: '15%', animationDelay: '-1s' }}>
            <p className="ep-titulo">Tareas de hoy</p>
            <ul className="mt-2.5 space-y-2">
              {TAREAS.map((t, i) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="ep-caja">
                    <svg viewBox="0 0 12 12" className="ep-visto" style={{ animationDelay: `${0.5 + i * 0.9}s` }}>
                      <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                    </svg>
                  </span>
                  <span className="ep-texto">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ep-tarjeta ep-flota" style={{ left: '8%', top: '55%', animationDelay: '-4s' }}>
            <p className="ep-titulo">Crecimiento</p>
            <svg viewBox="0 0 180 64" className="mt-2 w-full h-16 overflow-visible">
              <defs>
                <linearGradient id="ep-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7B5FBF" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#7B5FBF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="ep-area" d="M0 54 L30 46 L60 50 L90 34 L120 38 L150 20 L180 10 L180 64 L0 64 Z" fill="url(#ep-area)" />
              <path className="ep-linea" d="M0 54 L30 46 L60 50 L90 34 L120 38 L150 20 L180 10" />
            </svg>
          </div>

          <div className="ep-tarjeta ep-pastilla ep-flota" style={{ left: '5%', top: '82%', animationDelay: '-2.5s' }}>
            <span className="ep-llama" />
            <span className="ep-texto"><b>12 días</b> de racha</span>
          </div>

          {/* Derecha: se ven también con la pantalla partida. */}
          <div className="ep-tarjeta ep-flota" style={{ right: '6%', top: '13%', animationDelay: '-3s' }}>
            <p className="ep-titulo">Progreso semanal</p>
            <div className="mt-3 flex items-end gap-2 h-16">
              {BARRAS.map((h, i) => (
                <span key={i} className="ep-barra" style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between ep-dias">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>

          <div className="ep-tarjeta ep-flota flex items-center gap-4" style={{ right: '9%', top: '54%', animationDelay: '-5.5s' }}>
            <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
              <circle cx="32" cy="32" r="26" className="ep-anillo-fondo" />
              <circle cx="32" cy="32" r="26" className="ep-anillo" />
            </svg>
            <div>
              <p className="ep-titulo">Objetivo</p>
              <p className="ep-cifra">72 %</p>
            </div>
          </div>

          <div className="ep-tarjeta ep-flota" style={{ right: '5%', top: '80%', animationDelay: '-2s' }}>
            <div className="flex items-center justify-between gap-6">
              <p className="ep-titulo">Nivel 4</p>
              <p className="ep-texto"><b>+120</b> XP</p>
            </div>
            <div className="ep-xp mt-2"><span /></div>
          </div>
        </div>
      </div>

      {/* ── La raya ── */}
      <div className="raya-portada" style={{ opacity: modo === 'partido' ? 1 : 0 }} />
    </div>
  );
}
