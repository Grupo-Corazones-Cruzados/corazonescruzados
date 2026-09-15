'use client';

import { useState } from 'react';
import { Campo, Entrada, AreaTexto } from '@/componentes/ui';
import { Chips } from '@/componentes/campos';
import { DIAS_SEMANA, ETIQUETA_DIA, ETIQUETA_COMIDA } from '@/lib/catalogo';
import type { TipoComida, DiaSemana } from '@/generated/prisma/enums';

export type DatosServicio = {
  diasTotales: number;
  fechaInicio: string;
  tiposComida: TipoComida[];
  diasSemana: DiaSemana[];
  porcentajeCancelacion: number;
  notas: string | null;
};

/** Los campos de un servicio, una sola vez: alta, edición y renovación. */
export function CamposServicio({
  datos,
  comidas,
  diasNegocio,
}: {
  datos: DatosServicio;
  comidas: TipoComida[];
  /** Los días en que reparte el negocio: los únicos que se pueden marcar. */
  diasNegocio: DiaSemana[];
}) {
  const [tipos, setTipos] = useState<TipoComida[]>(datos.tiposComida);
  const [dias, setDias] = useState<DiaSemana[]>(datos.diasSemana);
  const opcionesDias = DIAS_SEMANA.filter((d) => diasNegocio.includes(d));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Días contratados" requerido>
          <Entrada name="diasTotales" type="number" min={1} max={365} defaultValue={datos.diasTotales} required />
        </Campo>
        <Campo etiqueta="Empieza el" requerido>
          <Entrada name="fechaInicio" type="date" defaultValue={datos.fechaInicio} required />
        </Campo>
        <Campo etiqueta="% de días cancelables" requerido>
          <Entrada name="porcentajeCancelacion" type="number" min={0} max={100} defaultValue={datos.porcentajeCancelacion} required />
        </Campo>
      </div>
      <Campo etiqueta="Comidas" requerido>
        <Chips nombre="tiposComida" opciones={comidas} etiquetas={ETIQUETA_COMIDA} valor={tipos} alCambiar={setTipos} />
      </Campo>
      <Campo etiqueta="Días de la semana" requerido>
        <Chips nombre="diasSemana" opciones={opcionesDias} etiquetas={ETIQUETA_DIA} valor={dias} alCambiar={setDias} />
      </Campo>
      <Campo etiqueta="Notas">
        <AreaTexto name="notas" rows={2} defaultValue={datos.notas ?? ''} placeholder="Pagó 20 almuerzos por transferencia, quiere empezar el lunes…" />
      </Campo>
    </div>
  );
}
