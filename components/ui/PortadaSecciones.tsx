'use client';

import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface SeccionPortada {
  key: string;
  label: string;
  Icon: LucideIcon;
  /** Grupo en el que sale (título pequeño encima). Las secciones sin grupo van primero. */
  grupo?: string;
  /** Una acción en vez de una sección (p. ej. «Compartir CV»): no abre pantalla. */
  onClick?: () => void;
}

/**
 * ⭐ PORTADA DE SECCIONES DEL TELÉFONO — definición ÚNICA (Fernando, 2026-10-29).
 *
 * Una página con varias secciones (Configuración, Admin…) en el teléfono NO apila todas ni
 * esconde las demás detrás de un selector: su portada es la lista de secciones, agrupadas,
 * cada fila con su icono en baldosa y «›». Al tocar una se abre en su propia pantalla con la
 * flecha de volver (`DetailHeader`), y la sección abierta vive en `?tab=` para que el «atrás»
 * del teléfono vuelva aquí. Desde `lg` cada página usa su disposición de escritorio.
 *
 *   <PortadaSecciones titulo="Admin" secciones={[...]} onAbrir={(key) => router.push(`?tab=${key}`)} />
 */
export default function PortadaSecciones({ titulo, cabecera, secciones, onAbrir }: {
  titulo: string;
  /** Lo que va entre el título y la lista (p. ej. la tarjeta de quién eres). */
  cabecera?: ReactNode;
  secciones: SeccionPortada[];
  onAbrir: (key: string) => void;
}) {
  const grupos: { g: string; filas: SeccionPortada[] }[] = [];
  for (const s of secciones) {
    const g = s.grupo ?? '';
    const grupo = grupos.find((x) => x.g === g) ?? (grupos.push({ g, filas: [] }), grupos[grupos.length - 1]);
    grupo.filas.push(s);
  }

  return (
    <div className="space-y-5" style={mf}>
      <h1 className="page-title pixel-heading text-digi-text">{titulo}</h1>
      {cabecera}
      {grupos.map(({ g, filas }) => (
        <section key={g || '_'}>
          {g && <h2 className="px-1 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-digi-muted">{g}</h2>}
          <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden divide-y divide-digi-border">
            {filas.map((s) => (
              <FilaSeccion key={s.key} Icon={s.Icon} label={s.label} onClick={s.onClick ?? (() => onAbrir(s.key))} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FilaSeccion({ Icon, label, onClick }: { Icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full min-h-[56px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-accent-light/40 transition-colors">
      <span className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center shrink-0"><Icon className="w-[18px] h-[18px] text-accent" /></span>
      <span className="flex-1 min-w-0 text-[14.5px] font-medium text-digi-text truncate">{label}</span>
      <ChevronRight className="w-[18px] h-[18px] text-digi-muted shrink-0" />
    </button>
  );
}
