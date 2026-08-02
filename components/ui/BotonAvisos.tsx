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
 * Con CERO avisos no se pinta nada, a propósito: un icono permanente en gris se vuelve
 * invisible y deja de avisar. Esa es la diferencia con `BotonAyuda`, que sí está siempre
 * porque la ayuda no es una alerta.
 *
 * La mecánica de la burbuja vive en `components/ui/burbuja.tsx`, compartida con
 * `BotonAyuda`.
 *
 * No es una superficie de EDICIÓN, así que no le aplica la regla del panel lateral: solo
 * muestra, no pide datos.
 */

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { TONO } from './tonos';
import { usarBurbuja, Burbuja } from './burbuja';

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
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const { burbujaRef, caja } = usarBurbuja(abierto, cerrar, botonRef, 'izquierda', avisos.length);

  const hayError = avisos.some((a) => a.tono === 'error');
  /** El botón toma el tono del aviso MÁS GRAVE: si hay un error, manda el error. */
  const tono = TONO[hayError ? 'error' : 'aviso'];

  if (avisos.length === 0) return null;

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
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

      {abierto && caja && (
        <Burbuja caja={caja} burbujaRef={burbujaRef} lado="izquierda" etiqueta={titulo}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-digi-border">
            <span className="text-[12px] font-semibold text-digi-text" style={mf}>{titulo}</span>
            <button type="button" onClick={cerrar} aria-label="Cerrar"
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
        </Burbuja>
      )}
    </>
  );
}
