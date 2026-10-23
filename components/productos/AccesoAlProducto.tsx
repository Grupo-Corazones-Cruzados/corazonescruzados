'use client';

import { LogIn, ExternalLink, AlertTriangle } from 'lucide-react';
import { BTN_PRIMARY } from '@/components/ui/Button';
import type { AccesoProducto } from '@/lib/productos/tipos';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * «ENTRAR A ORGANIZACIÓN» — el botón que abre el inquilino de la cuenta en un producto.
 *
 * Nació en la ficha del marketplace (Fernando, 2026-09-16) y el 2026-10-23 se mudó al
 * módulo **Plataformas**: *«quitemos el entrar a organización de aquí, y agreguemos un
 * módulo […] donde se puede ver las plataformas que tienes acceso»*. Se extrajo aquí para
 * que no haya dos.
 *
 * El texto es el mismo para todos («Entrar a Organización»); el nombre del inquilino solo
 * se añade si la cuenta tiene más de uno en el producto. Con la mensualidad vencida avisa
 * de cuántos días van: el acceso se cierra a los 30.
 */
export default function AccesoAlProducto({ accesos }: { accesos: AccesoProducto[] | undefined }) {
  if (!accesos?.length) return null;
  return (
    <div className="space-y-1.5">
      {accesos.map((a) => (
        <div key={a.url} className="space-y-1">
          <a href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${BTN_PRIMARY} w-full`} title={a.nombre}>
            <LogIn className="w-4 h-4" /> Entrar a Organización{accesos.length > 1 ? ` · ${a.nombre}` : ''} <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {a.diasDeRetraso ? (
            <p className="flex items-center gap-1 text-[11px] text-amber-700" style={mf}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> La mensualidad venció hace {a.diasDeRetraso} día{a.diasDeRetraso === 1 ? '' : 's'}: el acceso se cierra a los 30.
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
