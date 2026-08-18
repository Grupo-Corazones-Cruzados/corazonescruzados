'use client';

/**
 * LA TIRA VERTICAL DE CONCEPTOS — el panel derecho de `/soluciones`.
 *
 * Los conceptos de la solución abierta, uno debajo de otro, avanzando de arriba abajo. Es el
 * mismo carrusel que tenía la galería de Automatización, girado — lo pidió Fernando así
 * (2026-08-18).
 *
 * ── ⭐ LA REGLA QUE DEFINE ESTE COMPONENTE: SOLO SE MUEVE SI NO CABE ───────────
 * Textual: *«en caso de que la cantidad de conceptos no supere el tamaño disponible en
 * pantalla que no se ejecute la animación y solo se queden fijos»*. Y es la decisión
 * correcta: una lista que cabe entera y aun así se mueve es ruido, y encima obliga a
 * perseguir con la vista algo que ya estaba a la vista.
 *
 * Eso **no se puede decidir en CSS**: depende del alto real de los textos, que cambia con el
 * ancho de la ventana, con el tamaño de letra del usuario y con cuántos conceptos haya. Se
 * mide en el navegador con un `ResizeObserver`, que además reacciona al girar el móvil o al
 * cambiar el zoom sin que haya que recargar.
 *
 * ── POR QUÉ LA LISTA SE PINTA DOS VECES ───────────────────────────────────────
 * Para que el bucle no dé un tirón: se desplaza exactamente la mitad, así que al terminar la
 * segunda copia está donde estaba la primera y el salto de vuelta no se ve. La copia lleva
 * `aria-hidden` y `tabIndex={-1}`: para un lector de pantalla los conceptos son once, no
 * veintidós, y el tabulador no debe parar en once elementos repetidos.
 *
 * ⚠️ **Solo se duplica cuando hay animación.** Sin ella la copia sería contenido repetido a
 * la vista, que es un error, no un truco.
 *
 * ── LA VELOCIDAD SE CALCULA, NO SE FIJA ───────────────────────────────────────
 * A píxeles por segundo constantes. Con una duración fija, tres conceptos irían despacísimo
 * y treinta, disparados.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ICONOS } from './piezas';
import type { Concepto } from '@/lib/soluciones';

/** Píxeles por segundo. Bajo a propósito: esto es un fondo vivo, no algo que leer al vuelo. */
const VELOCIDAD = 26;

export default function TiraConceptos({ conceptos }: { conceptos: Concepto[] }) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const [anima, setAnima] = useState(false);
  const [duracion, setDuracion] = useState(0);

  const medir = useCallback(() => {
    const marco = marcoRef.current;
    const lista = listaRef.current;
    if (!marco || !lista) return;

    // `scrollHeight` de la lista SIN duplicar. Si ya está duplicada, su alto es el doble,
    // así que se divide: medir sobre la copia daría siempre «no cabe» y se quedaría animando
    // para siempre aunque el contenido cupiera.
    const altoLista = anima ? lista.scrollHeight / 2 : lista.scrollHeight;
    const altoMarco = marco.clientHeight;

    // Un margen de 8 px: si sobresale por dos píxeles, moverlo molesta más que ayuda.
    const noCabe = altoLista > altoMarco + 8;
    setAnima(noCabe);
    setDuracion(noCabe ? Math.max(altoLista / VELOCIDAD, 12) : 0);
  }, [anima]);

  useEffect(() => {
    medir();
    const marco = marcoRef.current;
    if (!marco || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => medir());
    ro.observe(marco);
    if (listaRef.current) ro.observe(listaRef.current);
    return () => ro.disconnect();
  }, [medir, conceptos.length]);

  // Sin conceptos no se pinta NADA: ni marco, ni título, ni hueco. Lo pidió Fernando y es la
  // regla del resto del sitio — una lista vacía no deja hueco ni «próximamente».
  if (conceptos.length === 0) return null;

  const tarjeta = (c: Concepto, copia: boolean) => {
    const Icono = ICONOS[c.icono] ?? ICONOS.capas;
    return (
      <li
        key={`${copia ? 'c' : 'o'}-${c.id}`}
        className="claro-tarjeta rounded-xl border border-[var(--linea)] bg-[var(--tarjeta)] p-4"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0
                         border border-[#7b5fbf]/25 bg-[#7b5fbf]/[0.08]">
          <Icono className="w-[18px] h-[18px] text-[var(--violeta-txt)]" />
        </span>
        <p className="mt-3 text-[14.5px] font-semibold leading-snug text-[var(--texto)]">{c.titulo}</p>
        {c.descripcion && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--suave)]">{c.descripcion}</p>
        )}
      </li>
    );
  };

  return (
    <aside aria-label="Lo que sabemos hacer" className="lg:sticky lg:top-24 lg:self-start">
      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
        Lo que sabemos hacer
      </p>
      <div
        ref={marcoRef}
        className={`tira-conceptos-marco relative overflow-hidden lg:h-[calc(100vh-13rem)]
                    ${anima ? 'tira-conceptos-marco--anima' : ''}`}
      >
        <ul
          ref={listaRef}
          className={`space-y-3 ${anima ? 'tira-conceptos-anima' : ''}`}
          style={anima ? { animationDuration: `${duracion}s` } : undefined}
        >
          {conceptos.map((c) => tarjeta(c, false))}
          {/* La copia, solo si hay animación. Ver el aviso de arriba. */}
          {anima && (
            <div aria-hidden className="contents">
              {conceptos.map((c) => tarjeta(c, true))}
            </div>
          )}
        </ul>
      </div>
    </aside>
  );
}
