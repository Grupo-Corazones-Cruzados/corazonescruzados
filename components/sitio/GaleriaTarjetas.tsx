'use client';

/**
 * LA GALERÍA DE TARJETAS. Vive aparte de `piezas.tsx` porque necesita estado —cuál está
 * abierta— y eso obliga a que sea un componente de cliente.
 *
 * ⚠️ Que sea de cliente **no** esconde nada de un buscador: Next lo renderiza igualmente en
 * el servidor, así que los once títulos, sus líneas y las descripciones completas de la
 * ventana están en el HTML aunque nadie pulse nada.
 */

import { useState } from 'react';
import { Layers } from 'lucide-react';
import type { ItemGaleria } from '@/lib/sitio/contenido';
import { ICONOS, TituloSeccion } from './piezas';
import VentanaTarjeta from './VentanaTarjeta';

/**
 * GALERÍA DE TARJETAS PEQUEÑAS — icono, título y una línea.
 *
 * Para cuando hay que **enumerar** muchas cosas (once en Automatización) en vez de explicar
 * un flujo. Un bloque grande por cada una haría una página infinita; una lista con viñetas
 * no se lee.
 *
 * ── LAS DECISIONES DE COLOCACIÓN ───────────────────────────────────────────────
 * · **`flex-wrap` centrado, no rejilla.** Once no es múltiplo de tres: con `grid-cols-3` la
 *   última fila deja dos tarjetas pegadas a la izquierda y un hueco. Envolviendo y centrando,
 *   la última fila se centra sola — y sigue funcionando si mañana son nueve o catorce.
 * · **Ancho fijo de 300 px.** Todas iguales aunque sus textos midan distinto.
 * · **El icono, arriba y a la izquierda**, del mismo tamaño que en las tarjetas de la
 *   cabecera: es el mismo lenguaje, solo que aquí hay muchas más.
 *
 * ── LOS EFECTOS ────────────────────────────────────────────────────────────────
 * · **Entrada escalonada al desplazarse** (`.galeria-anima`, en `globals.css`): las tarjetas
 *   no aparecen de golpe, van llegando. Como el resto del sitio, es CSS ligado al scroll —
 *   sin JavaScript, y el contenido está en el HTML desde el primer momento.
 * · **Al pasar el puntero**: la tarjeta **sube 2 px**, el borde se tiñe de violeta y el
 *   cuadro del icono se enciende. Nada de sombras — el realce de este sitio es de borde.
 * · **`focus-within`** hace lo mismo al recorrerla con el teclado.
 */
export default function GaleriaTarjetas({
  etiqueta, titulo, entradilla, items, desliza,
}: {
  etiqueta?: string;
  titulo?: string;
  entradilla?: string;
  desliza?: boolean;
  items: ItemGaleria[];
}) {
  const [abierta, setAbierta] = useState<ItemGaleria | null>(null);

  /**
   * La tarjeta, igual en los dos modos.
   *
   * Es un `<button>` y no un `<div>` con `onClick`: así se alcanza con el tabulador, se
   * activa con Intro o espacio y un lector de pantalla la anuncia como algo pulsable. Un
   * `div` clicable no hace nada de eso.
   *
   * La copia de la tira deslizante va `aria-hidden` **y** `tabIndex={-1}`: sin lo segundo,
   * el tabulador seguiría parando en once botones invisibles para el lector.
   */
  const tarjeta = (it: ItemGaleria, oculta = false) => {
    const Icono = ICONOS[it.icono] ?? Layers;
    return (
      <li
        key={it.titulo + (oculta ? '-copia' : '')}
        aria-hidden={oculta || undefined}
        className={desliza ? 'w-[300px] shrink-0' : 'w-full sm:w-[300px]'}
      >
        <button
          type="button"
          onClick={() => setAbierta(it)}
          tabIndex={oculta ? -1 : undefined}
          className="group h-full w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] p-5
                     transition-[transform,border-color,background-color] duration-200
                     hover:-translate-y-0.5 hover:border-[#7B5FBF]/45 hover:bg-white/[0.04]
                     focus:outline-none focus-visible:-translate-y-0.5 focus-visible:border-[#7B5FBF]/45
                     focus-visible:ring-2 focus-visible:ring-[#7B5FBF]/50"
        >
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg border transition-colors
                       border-[#7B5FBF]/30 bg-[#7B5FBF]/10
                       group-hover:border-[#7B5FBF]/60 group-hover:bg-[#7B5FBF]/25"
          >
            <Icono className="w-5 h-5 text-[#a78bfa] transition-colors group-hover:text-[#c4b5fd]" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-white leading-snug">{it.titulo}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{it.texto}</p>
        </button>
      </li>
    );
  };

  if (desliza) {
    return (
      <section>
        {titulo && <TituloSeccion etiqueta={etiqueta} titulo={titulo} entradilla={entradilla} />}

        {/* ── DE BORDE A BORDE DE LA PANTALLA ──────────────────────────────────────
            La tira vive dentro del ancho de lectura (`max-w-6xl`) y tiene que salirse
            de él. `left-1/2` la lleva al centro de la página y `-translate-x-1/2` la
            devuelve media pantalla a la izquierda: el resultado es exactamente el ancho
            de la ventana, venga de donde venga su contenedor.
            ⚠️ `100vw` incluye la barra de desplazamiento, así que sin el `overflow-x-clip`
            del `<section id="detalle">` esto añadiría barra horizontal a toda la página.
            Se usa `clip` y no `hidden` porque `hidden` crearía un contenedor de scroll y
            rompería el salto a las anclas de los temas. */}
        <div
          className={`tira-desliza-marco relative left-1/2 -translate-x-1/2 w-screen overflow-hidden py-2
                      ${titulo ? 'mt-12' : ''}`}
          style={{
            // Las tarjetas se desvanecen al entrar y al salir en vez de aparecer
            // cortadas por un borde recto. Es lo que hace que «vayan apareciendo».
            maskImage: 'linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 7%, black 93%, transparent 100%)',
          }}
        >
          {/* La lista va DUPLICADA y la animación recorre justo la mitad: al terminar, la
              copia está donde estaba el original y el bucle no da tirón. La segunda pasada
              lleva `aria-hidden` para que un lector de pantalla no lea las once dos veces. */}
          <ul className="tira-desliza flex w-max gap-4 px-2">
            {items.map((it) => tarjeta(it))}
            {items.map((it) => tarjeta(it, true))}
          </ul>
        </div>

        <VentanaTarjeta item={abierta} onCerrar={() => setAbierta(null)} />
      </section>
    );
  }

  return (
    <section>
      {titulo && <TituloSeccion etiqueta={etiqueta} titulo={titulo} entradilla={entradilla} />}
      <ul className={`galeria-anima flex flex-wrap justify-center gap-4 ${titulo ? 'mt-12' : ''}`}>
        {items.map((it) => tarjeta(it))}
      </ul>

      <VentanaTarjeta item={abierta} onCerrar={() => setAbierta(null)} />
    </section>
  );
}

