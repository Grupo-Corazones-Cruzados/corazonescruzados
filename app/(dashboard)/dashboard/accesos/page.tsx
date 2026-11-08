'use client';

import { Megaphone } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * ACCESOS — la pantalla de inicio de las apps GCC World y GCC Miembros (Fernando, 2026-11-08). Se
 * inicia sesión como siempre y se llega aquí (`middleware.ts`). Las apps, los productos y las
 * herramientas están en el menú lateral (`components/accesos/MenuAccesos`); esta pantalla es para
 * COMUNICADOS: anuncios, noticias, parches y mantenimientos. Por ahora vacía: Fernando la vinculará
 * a un sistema de Centralizado.
 */
export default function AccesosPage() {
  return (
    <div className="flex flex-col gap-4 max-w-3xl" style={mf}>
      <h1 className="text-[18px] font-semibold text-digi-text">Comunicados</h1>
      <div className="pixel-card text-center py-14">
        <Megaphone className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
        <p className="text-[14px] font-semibold text-digi-text">Sin comunicados por ahora</p>
        <p className="text-[12.5px] text-digi-muted mt-1">Aquí aparecerán los anuncios, las novedades y los mantenimientos.</p>
      </div>
    </div>
  );
}
