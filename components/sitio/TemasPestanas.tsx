'use client';

/**
 * LOS TEMAS EN PESTAÑAS NUMERADAS — Clientes (Fernando, 2026-10-31: «reformula por completo el
 * diseño para dividir temas… más profesional, apegado a la página de inicio»).
 *
 * Sustituye a las puertas en bloque + la página de la sección debajo. El patrón es el de las
 * secciones de producto con pestañas (Stripe, Linear): una fila de pestañas numeradas con una raya
 * que se llena en la elegida, y UN panel grande que cambia en el sitio, deslizándose desde el lado
 * hacia el que se avanzó. El panel es una tarjeta del mundo Progreso de la portada, y a la derecha
 * lleva el icono del tema en un orbe con halos, como el cruce del corazón.
 *
 * · Cambiar de tema NO navega: cambia el estado y reescribe la URL (`/clientes/<tema>`) con
 *   `replaceState`, así el enlace se puede compartir y abrir directo (lo pinta el servidor).
 * · Accesible: `tablist` / `tab` / `tabpanel`, y flechas ← → entre pestañas.
 * · Sin texto inventado: solo el título y la descripción de cada tema (los escribe Fernando).
 */

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface TemaPestana {
  id: string;
  titulo: string;
  /** Ya con sus negritas, preparada en el servidor; `null` si el tema aún no tiene texto. */
  descripcion: ReactNode;
  icono: ReactNode;
  iconoGrande: ReactNode;
  /** Lo que va debajo de la tarjeta del tema (p. ej. la lista de soluciones). */
  contenido?: ReactNode;
}

export default function TemasPestanas({
  temas, inicial, base,
}: {
  temas: TemaPestana[];
  inicial: string;
  /** La ruta de la que cuelgan los temas (`/clientes`). */
  base: string;
}) {
  const [activa, setActiva] = useState(inicial);
  const [dir, setDir] = useState<'der' | 'izq' | null>(null);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const i = Math.max(0, temas.findIndex((t) => t.id === activa));
  const tema = temas[i];

  const elegir = (j: number) => {
    if (j === i) return;
    setDir(j > i ? 'der' : 'izq');
    setActiva(temas[j].id);
    window.history.replaceState(null, '', `${base}/${temas[j].id}`);
  };

  const teclas = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + temas.length) % temas.length;
    elegir(j);
    botones.current[j]?.focus();
  };

  return (
    <section className="temas" aria-label="Temas">
      <div className="temas-pestanas" role="tablist" aria-orientation="horizontal" onKeyDown={teclas}
        style={{ gridTemplateColumns: `repeat(${temas.length}, minmax(0, 1fr))` }}>
        {temas.map((t, j) => (
          <button
            key={t.id}
            ref={(el) => { botones.current[j] = el; }}
            type="button"
            role="tab"
            id={`tema-${t.id}`}
            aria-selected={j === i}
            aria-controls="tema-panel"
            tabIndex={j === i ? 0 : -1}
            className="tema-pestana"
            onClick={() => elegir(j)}
          >
            <span className="tema-pestana-raya" aria-hidden />
            <span className="tema-pestana-num">{String(j + 1).padStart(2, '0')}</span>
            <span className="tema-pestana-titulo">
              <span className="tema-pestana-icono" aria-hidden>{t.icono}</span>
              {t.titulo}
            </span>
          </button>
        ))}
      </div>

      <div
        key={tema.id}
        id="tema-panel"
        role="tabpanel"
        aria-labelledby={`tema-${tema.id}`}
        className="tema-panel"
        data-dir={dir ?? undefined}
      >
        <div className="tema-panel-cuerpo">
          <p className="tema-panel-num">{String(i + 1).padStart(2, '0')} / {String(temas.length).padStart(2, '0')}</p>
          {/* El `<h1>` de la página es el tema abierto: cada URL, su título. */}
          <h1 className="tema-panel-titulo">{tema.titulo}</h1>
          {tema.descripcion && <p className="tema-panel-texto">{tema.descripcion}</p>}
        </div>
        <div className="tema-orbe" aria-hidden>
          <span className="tema-orbe-halo" />
          <span className="tema-orbe-anillo" />
          <span className="tema-orbe-anillo tema-orbe-anillo-2" />
          <span className="tema-orbe-nucleo">{tema.iconoGrande}</span>
        </div>
      </div>
      {tema.contenido && <div key={`${tema.id}-contenido`} className="tema-contenido">{tema.contenido}</div>}
    </section>
  );
}
