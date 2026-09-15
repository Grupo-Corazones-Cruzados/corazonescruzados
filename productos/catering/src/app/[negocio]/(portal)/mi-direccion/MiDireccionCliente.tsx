'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
    <>
      <CabeceraPagina titulo="Mi dirección" descripcion="Dónde te llevamos la comida y con qué particularidades" />
      <div className="p-4 sm:p-6">
        <Tarjeta className="p-5">
          <form action={(d) => arranca(async () => { setError(null); const r = await editarMiPerfil(slug, d); if (!r.ok) return setError(r.error); toast.success('Dirección guardada'); router.refresh(); })} className="space-y-6">
            <CamposCliente datos={datos} comidas={comidas} secciones={['direccion', 'despacho']} />
            <CamposOcultosDireccion datos={datos} que="personales" />
            {error && <Aviso texto={error} />}
            <div className="flex justify-end border-t border-borde pt-4"><Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></div>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
