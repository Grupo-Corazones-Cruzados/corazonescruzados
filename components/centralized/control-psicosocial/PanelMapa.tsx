'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import BotonCerrar from '@/components/ui/BotonCerrar';
import { useAparicion } from '@/lib/hooks/useAparicion';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Contenido = { titulo: ReactNode; subtitulo?: ReactNode; pie?: ReactNode; cuerpo: ReactNode };

/**
 * Lo que abre una opción del mapa: flota SOBRE el mapa para que se siga viendo. En escritorio, una
 * columna a la derecha; en el teléfono, una hoja abajo, por encima de los botones de emergencia, que
 * nunca se tapan. Mientras sale sigue enseñando su último contenido: quien lo abrió ya lo vació.
 */
export default function PanelMapa({
  contenido, onCerrar, onVolver,
}: {
  /** `null` = cerrado. */
  contenido: Contenido | null;
  onCerrar: () => void;
  /** Con él, una flecha vuelve a la opción anterior. */
  onVolver?: () => void;
}) {
  const { montado, visible } = useAparicion(!!contenido);
  const ultimo = useRef<Contenido | null>(contenido);
  if (contenido) ultimo.current = contenido;
  const c = contenido ?? ultimo.current;
  if (!montado || !c) return null;
  return (
    <aside
      style={mf}
      className={`absolute z-20 left-2 right-2 bottom-[68px] max-h-[58%] md:left-auto md:right-3 md:top-3 md:bottom-3 md:w-[360px] md:max-h-none
        flex flex-col overflow-hidden rounded-lg border border-digi-border cp-opaco shadow-lg
        transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none
        ${visible ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-y-4 md:translate-y-0 md:translate-x-4 pointer-events-none'}`}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-digi-border">
        {onVolver && (
          <button onClick={onVolver} aria-label="Volver" title="Volver" className="w-8 h-8 -ml-1 inline-flex items-center justify-center rounded-md text-digi-muted hover:text-accent">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-digi-text">{c.titulo}</h3>
          {c.subtitulo && <p className="truncate text-[11px] text-digi-muted">{c.subtitulo}</p>}
        </div>
        <BotonCerrar onClick={onCerrar} />
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">{c.cuerpo}</div>
      {c.pie && <div className="shrink-0 border-t border-digi-border p-3">{c.pie}</div>}
    </aside>
  );
}
