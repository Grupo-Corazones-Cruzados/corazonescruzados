'use client';

/**
 * EL SELECTOR SEGMENTADO DEL SITIO — cápsula que se desliza a la opción elegida, con la cuenta al
 * lado (computadora), y `<select>` nativo a todo el ancho (teléfono). Regla de `/diseno` §4-ter.
 *
 * Nació dentro de `SolucionesExplorador` (las pestañas de un talento) y se extrajo el 2026-10-31
 * para el filtro de estado de los tickets de Clientes: un control que ya existe se reusa, no se
 * reescribe parecido.
 */

import { useLayoutEffect, useRef, useState } from 'react';

export interface OpcionSegmentada<T extends string> {
  id: T;
  label: string;
  cuenta: number;
}

export default function SelectorSegmentado<T extends string>({
  opciones, valor, onCambiar, etiqueta,
}: {
  opciones: OpcionSegmentada<T>[];
  valor: T;
  onCambiar: (v: T) => void;
  /** Para lectores de pantalla: qué se elige («Contenido del talento», «Estado»…). */
  etiqueta: string;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const capsulaRef = useRef<HTMLSpanElement>(null);
  const [lista, setLista] = useState(false);
  useLayoutEffect(() => {
    const marco = marcoRef.current;
    const capsula = capsulaRef.current;
    if (!marco || !capsula) return;
    const colocar = () => {
      const b = marco.querySelector<HTMLElement>(`[data-pestana="${valor}"]`);
      if (!b) return;
      capsula.style.transform = `translateX(${b.offsetLeft}px)`;
      capsula.style.width = `${b.offsetWidth}px`;
    };
    colocar();
    setLista(true);
    const ro = new ResizeObserver(colocar);
    ro.observe(marco);
    return () => ro.disconnect();
  }, [valor]);

  return (
    <>
      <div ref={marcoRef} role="tablist" aria-label={etiqueta} className="segmentado-trabajos">
        <span ref={capsulaRef} className={`segmentado-capsula ${lista ? 'es-lista' : ''}`} aria-hidden />
        {opciones.map((o) => {
          const activa = o.id === valor;
          return (
            <button
              key={o.id}
              type="button"
              role="tab"
              data-pestana={o.id}
              aria-selected={activa}
              onClick={() => onCambiar(o.id)}
              className={`segmentado-opcion ${activa ? 'es-activa' : ''}`}
            >
              {o.label}
              <span className="segmentado-cuenta">{o.cuenta}</span>
            </button>
          );
        })}
      </div>
      <label className="segmentado-movil">
        <span className="sr-only">{etiqueta}</span>
        <select value={valor} onChange={(e) => onCambiar(e.target.value as T)}>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>Ver: {o.label} · {o.cuenta}</option>
          ))}
        </select>
      </label>
    </>
  );
}
