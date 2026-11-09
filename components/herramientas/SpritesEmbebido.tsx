'use client';

import { useState } from 'react';
import EspacioEmbebido from '@/components/espacio/EspacioEmbebido';
import { firmarPeticionesDeLaPagina } from '@/components/espacio/api';
import { Cortador } from '@/components/herramientas/CortadorSprites';

/** El Cortador de sprites dentro de las apps: lo sirve la Mac, que es donde está la carpeta del juego. */
export default function SpritesEmbebido() {
  useState(() => { if (typeof window !== 'undefined') firmarPeticionesDeLaPagina(); });
  return (
    <EspacioEmbebido titulo="Cortador de sprites">
      <div className="h-full overflow-y-auto p-3 xl:p-4">
        <Cortador />
      </div>
    </EspacioEmbebido>
  );
}
