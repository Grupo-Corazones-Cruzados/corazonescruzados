'use client';

import { useState } from 'react';
import EspacioEmbebido from '@/components/espacio/EspacioEmbebido';
import { firmarPeticionesDeLaPagina } from '@/components/espacio/api';
import { SistemaLocal } from '@/components/centralized/systems/GeneracionDeContenidoSystem';

export default function ContenidoEmbebido() {
  useState(() => { if (typeof window !== 'undefined') firmarPeticionesDeLaPagina(); });
  return (
    <EspacioEmbebido titulo="Generación de Contenido">
      <div className="h-full overflow-y-auto p-3 xl:p-4">
        <SistemaLocal enMarco />
      </div>
    </EspacioEmbebido>
  );
}
