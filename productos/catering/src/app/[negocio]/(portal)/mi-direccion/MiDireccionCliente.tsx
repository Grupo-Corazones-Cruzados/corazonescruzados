'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Tarjeta } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CamposCliente, CamposOcultosDireccion, type DatosCliente } from '@/componentes/FormularioCliente';
import { editarMiPerfil } from '@/acciones/clientes';
import type { TipoComida } from '@/generated/prisma/enums';

export default function MiDireccionCliente({ slug, comidas, datos }: { slug: string; comidas: TipoComida[]; datos: DatosCliente }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  return (
    <div className="flex flex-1 flex-col">
      {/* «Guardar» en la barra de abajo en el teléfono, unido al formulario con `form=`. */}
      <CabeceraPagina titulo="Mi dirección" descripcion="Dónde te llevamos la comida y con qué particularidades"
        accionesTelefono={<Boton form="form-direccion" type="submit" icono={Save} disabled={enCurso}>Guardar</Boton>} />
      <div className="flex flex-1 flex-col p-4 sm:p-6">
        {/* La tarjeta llega hasta el pie (regla 2026-11-08). */}
        <Tarjeta className="flex flex-1 flex-col p-4 sm:p-5">
          <form id="form-direccion" action={(d) => arranca(async () => { setError(null); const r = await editarMiPerfil(slug, d); if (!r.ok) return setError(r.error); toast.success('Guardado.'); router.refresh(); })} className="space-y-6">
            <CamposCliente datos={datos} comidas={comidas} secciones={['direccion', 'despacho']} />
            <CamposOcultosDireccion datos={datos} que="personales" />
            {error && <Aviso texto={error} />}
            <div className="hidden justify-end lg:flex"><Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></div>
          </form>
        </Tarjeta>
      </div>
    </div>
  );
}
