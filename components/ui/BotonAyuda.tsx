'use client';

/**
 * BOTÓN DE AYUDA (?) con burbuja flotante — definición ÚNICA reusable.
 *
 * Para las explicaciones que hacen falta **la primera vez** y estorban todas las demás:
 * cómo escribir los bloques de conocimiento, qué es el mínimo de caché, qué significa la
 * coexistencia. Antes vivían como párrafos fijos encima del contenido.
 *
 * Por qué se sacaron de la página: un párrafo explicativo permanente lo lee todo el mundo
 * una vez y nadie más, pero sigue ocupando sitio y empujando hacia abajo lo que de verdad
 * se viene a usar. Detrás de un (?) sigue estando a un clic, y quien ya lo sabe no lo ve.
 *
 * Hermano de `BotonAvisos`: comparten la mecánica de la burbuja (`components/ui/burbuja.tsx`)
 * pero NO el propósito. El de avisos grita —lleva color y contador, y sin avisos desaparece—;
 * este es discreto y está siempre, porque la ayuda no es una alerta.
 *
 * No es una superficie de EDICIÓN, así que no le aplica la regla del panel lateral.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { usarBurbuja, Burbuja, type LadoBurbuja } from './burbuja';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function BotonAyuda({
  titulo,
  children,
  lado = 'izquierda',
  ancho,
  className = '',
}: {
  /** Encabezado de la burbuja. También es la etiqueta accesible del botón. */
  titulo: string;
  /** El contenido de la ayuda. Admite marcado, no solo texto plano. */
  children: ReactNode;
  /** A qué lado del botón sale la burbuja. Por defecto a la izquierda. */
  lado?: LadoBurbuja;
  ancho?: number;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const { burbujaRef, caja } = usarBurbuja(abierto, cerrar, botonRef, lado);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={`Ayuda: ${titulo}`}
        aria-expanded={abierto}
        title={titulo}
        // Discreto por defecto y accent al pasar por encima: la ayuda tiene que estar
        // disponible sin competir con la acción principal que suele tener al lado.
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-colors
          ${abierto ? 'text-accent bg-accent-light' : 'text-digi-muted hover:text-accent hover:bg-accent-light'}
          ${className}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {abierto && caja && (
        <Burbuja caja={caja} burbujaRef={burbujaRef} lado={lado} etiqueta={titulo} ancho={ancho}
          contenedor={botonRef.current?.closest('dialog')}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-digi-border">
            <span className="text-[12px] font-semibold text-digi-text" style={mf}>{titulo}</span>
            <button type="button" onClick={cerrar} aria-label="Cerrar"
              className="text-digi-muted hover:text-digi-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="px-3 py-2.5 text-[12.5px] text-digi-muted leading-relaxed max-h-[60vh] overflow-y-auto
                       [&_strong]:text-digi-text [&_code]:text-accent [&_code]:text-[11.5px]"
            style={mf}
          >
            {children}
          </div>
        </Burbuja>
      )}
    </>
  );
}
