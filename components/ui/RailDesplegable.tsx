'use client';

import { useState, type ReactNode } from 'react';
import { PanelRightOpen } from 'lucide-react';
import { useConsultaMedia } from '@/lib/hooks/useConsultaMedia';

/** Hay un ratón o un trackpad: `hover` existe. En táctil no, y el raíl se queda fijo. */
const CON_PUNTERO = '(hover: hover) and (pointer: fine)';

/**
 * ¿El raíl derecho va PLEGADO (se abre al pasar el puntero) a este ancho? Lo pregunta la
 * página para quitarle su columna a la rejilla: plegado, el centro se queda con todo el ancho.
 */
export function useRailDesplegable(desde: string): boolean {
  const conPuntero = useConsultaMedia(CON_PUNTERO);
  const ancho = useConsultaMedia(desde);
  return conPuntero && ancho;
}

/** Campos en los que se escribe: mientras uno tiene el foco, el raíl no se cierra. */
const esCampo = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

/**
 * ⇒ EL RAÍL DERECHO (PROPIEDADES / INCIDENTES) SE ABRE AL PASAR EL PUNTERO (Fernando, 2026-10-16).
 *
 * Es de consulta: se mira y se vuelve al trabajo. Plegado deja solo un INDICADOR en el borde
 * derecho; al acercar el puntero se despliega y al salir se pliega, igual que el menú de la
 * izquierda (`DashboardSidebar`). Y como aquel, se monta ENCIMA del contenido, no lo empuja: si
 * empujara, el registro de trabajo se reacomodaría cada vez que el ratón cruza el borde.
 *
 * - Necesita un ancestro con `relative` y un margen derecho para el indicador (`RAIL_HUECO`).
 * - No se cierra mientras se escribe en uno de sus campos, aunque el puntero salga.
 * - Pulsar el indicador lo deja ABIERTO (fijado) hasta volver a pulsarlo: así se llega con el
 *   teclado, y no hay que mantener el ratón encima para leer algo largo.
 * - Plegado, su contenido es `inert`: no se llega a él con el tabulador sin verlo.
 * - Sin puntero (táctil) o por debajo de `desde`, no se pliega: es el bloque de siempre, con
 *   `className`. Se decide en JS porque cambia la estructura, no solo el aspecto.
 */
export default function RailDesplegable({ desde, className, children }: {
  /** Consulta de ancho a partir de la cual se pliega (p. ej. `PANTALLA_XL`). */
  desde: string;
  /** Clases del bloque cuando NO se pliega. */
  className?: string;
  children: ReactNode;
}) {
  const plegable = useRailDesplegable(desde);
  const [sobre, setSobre] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [fijado, setFijado] = useState(false);

  if (!plegable) return <div className={className}>{children}</div>;

  const abierto = sobre || escribiendo || fijado;
  return (
    <div
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      onFocus={(e) => { if (esCampo(e.target)) setEscribiendo(true); }}
      onBlur={(e) => { if (esCampo(e.target)) setEscribiendo(false); }}
      className="absolute inset-y-0 right-0 z-30 flex"
    >
      {/* `transition-[width]`: lo único que cambia al abrirse es el ancho (como el menú). */}
      <div inert={!abierto} className={`h-full overflow-hidden transition-[width] duration-200 ${abierto ? 'w-[324px]' : 'w-0'}`}>
        <div className="w-[324px] h-full overflow-y-auto space-y-3 p-3 bg-digi-dark border border-digi-border rounded-lg shadow-2xl">
          {children}
        </div>
      </div>
      <button type="button" onClick={() => setFijado((f) => !f)} aria-expanded={abierto}
        aria-label={fijado ? 'Plegar Propiedades e Incidentes' : 'Fijar Propiedades e Incidentes'}
        title={fijado ? 'Plegar' : 'Propiedades e Incidentes'}
        className={`ml-1.5 w-5 h-full flex flex-col items-center gap-2 pt-1 rounded-md border transition-colors ${
          abierto ? 'border-accent/40 bg-accent-light text-accent' : 'border-digi-border bg-digi-card text-digi-muted hover:text-accent hover:border-accent/40'
        }`}>
        <PanelRightOpen className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[10.5px] font-medium tracking-wide [writing-mode:vertical-rl]">Propiedades · Incidentes</span>
      </button>
    </div>
  );
}

/** Margen derecho que necesita el contenedor para el indicador plegado (`w-5` + `ml-1.5`). */
export const RAIL_HUECO = 'pr-8';
