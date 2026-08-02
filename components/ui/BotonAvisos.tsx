'use client';

/**
 * BOTÓN DE ADVERTENCIAS con burbuja flotante — definición ÚNICA reusable.
 *
 * Para avisos que hay que poder consultar pero que **no deben ocupar la pantalla**
 * mientras se trabaja. Un icono con el número de avisos junto a la acción principal; al
 * pulsarlo, una burbuja flotante **a la izquierda del botón** con la lista.
 *
 * Por qué no una tira de banners: apilados sobre el contenido empujan lo importante
 * hacia abajo y, en cuanto son más de uno, se dejan de leer. Aquí el aviso sigue
 * visible —el icono cambia de color y lleva el conteo— pero solo ocupa sitio cuando se
 * pide.
 *
 * Sustituye al patrón de burbuja copiado inline en el Horario de Vida y en
 * `GenerateTasksModal`: aquello estaba duplicado y se veía distinto en cada sitio.
 *
 * No es una superficie de EDICIÓN, así que no le aplica la regla del panel lateral: solo
 * muestra, no pide datos.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { TONO } from './tonos';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TonoAviso = 'error' | 'aviso';

export interface Aviso {
  tono: TonoAviso;
  texto: string;
}

export default function BotonAvisos({
  avisos,
  titulo = 'Advertencias',
}: {
  avisos: Aviso[];
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  /** `flechaY` es la altura de la punta DENTRO de la burbuja, en píxeles desde su borde superior. */
  const [caja, setCaja] = useState<{ top: number; right: number; flechaY: number; listo: boolean } | null>(null);
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const burbujaRef = useRef<HTMLDivElement | null>(null);

  const hayError = avisos.some((a) => a.tono === 'error');
  /** El botón toma el tono del aviso MÁS GRAVE: si hay un error, manda el error. */
  const tono = TONO[hayError ? 'error' : 'aviso'];

  /**
   * Posición, en dos pasadas y antes de pintar.
   *
   * ⚠️ Centrar la burbuja en el botón y ya está NO vale, y se vio midiendo en un navegador
   * de verdad: el botón vive en la cabecera, cerca del borde superior, y con cuatro o
   * cinco avisos la burbuja es más alta que el hueco que hay encima. Centrada, se salía
   * por arriba de la pantalla (`top: -41`) y los primeros avisos quedaban fuera.
   *
   * Así que se acota al viewport, y la PUNTA se mueve dentro de la burbuja para seguir
   * señalando al botón aunque el cuerpo ya no esté centrado.
   */
  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return;
    const r = botonRef.current.getBoundingClientRect();
    const centro = r.top + r.height / 2;
    const derecha = window.innerWidth - r.left + 8; // a la IZQUIERDA del botón

    const alto = burbujaRef.current?.offsetHeight;
    if (!alto) {
      // Primera pasada: aún no existe el nodo. Se coloca en su sitio provisional y se
      // deja invisible para que la segunda pasada no produzca un salto visible.
      setCaja({ top: centro, right: derecha, flechaY: 0, listo: false });
      return;
    }

    const MARGEN = 8;
    const tope = Math.max(MARGEN, Math.min(centro - alto / 2, window.innerHeight - alto - MARGEN));
    // La punta se queda a la altura del botón, sin salirse de la burbuja por los bordes.
    const flechaY = Math.max(12, Math.min(centro - tope, alto - 12));
    setCaja({ top: tope, right: derecha, flechaY, listo: true });
  }, [abierto, avisos.length, caja?.listo]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (burbujaRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    // Al desplazar o redimensionar se cierra en vez de recolocarse: perseguir el botón
    // mientras la página se mueve se ve peor que cerrar y volver a abrir.
    const mover = () => { setAbierto(false); setCaja(null); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', mover, true);
    window.addEventListener('resize', mover);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', mover, true);
      window.removeEventListener('resize', mover);
    };
  }, [abierto]);

  if (avisos.length === 0) return null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => { setCaja(null); setAbierto((v) => !v); }}
        aria-label={`${avisos.length} ${avisos.length === 1 ? 'advertencia' : 'advertencias'}`}
        aria-expanded={abierto}
        title={`${avisos.length} ${avisos.length === 1 ? 'advertencia' : 'advertencias'}`}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded border transition-colors
          ${tono.control} ${abierto ? `ring-2 ring-offset-1 ${tono.anillo}` : ''}`}
      >
        <AlertTriangle className="w-4 h-4" />
        {/* El contador NO va relleno de color: un relleno sólido obliga a texto blanco, y
            el ámbar del tema es oscuro en claro pero dorado claro en oscuro — el blanco
            deja de leerse. Con el tono sobre la superficie de la tarjeta funciona en los
            dos temas sin excepciones. */}
        <span
          className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold
            flex items-center justify-center border bg-digi-card ${tono.texto} ${tono.caja.split(' ')[0]}`}
          style={mf}
        >
          {avisos.length}
        </span>
      </button>

      {abierto && caja && createPortal(
        <div
          ref={burbujaRef}
          role="dialog"
          aria-label={titulo}
          // z-[80] para quedar por encima del banner de Comandos Violeta (z-[60]) y de
          // los paneles deslizantes (z-[70]).
          className="fixed z-[80] w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-digi-border
                     bg-digi-card shadow-xl"
          style={{
            top: caja.top,
            right: caja.right,
            // Invisible en la primera pasada, pero ocupando sitio para poder medirla.
            visibility: caja.listo ? 'visible' : 'hidden',
          }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-digi-border">
            <span className="text-[12px] font-semibold text-digi-text" style={mf}>{titulo}</span>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar"
              className="text-digi-muted hover:text-digi-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <ul className="py-1 max-h-[60vh] overflow-y-auto">
            {avisos.map((a, i) => (
              <li key={i} className="flex gap-2 px-3 py-2 border-b border-digi-border last:border-b-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${TONO[a.tono].punto}`} />
                <span className={`text-[12.5px] leading-relaxed ${TONO[a.tono].texto}`} style={mf}>
                  {a.texto}
                </span>
              </li>
            ))}
          </ul>

          {/* La punta, a la altura del botón — no siempre en el centro de la burbuja. */}
          <span
            className="absolute -right-[6px] w-3 h-3 rotate-45 bg-digi-card border-r border-t border-digi-border"
            style={{ top: caja.flechaY, marginTop: -6 }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
