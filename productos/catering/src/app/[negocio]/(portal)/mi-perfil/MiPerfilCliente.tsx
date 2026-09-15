'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserRound, ShieldAlert, KeyRound } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Tarjeta, RailFiltro, Campo, Entrada } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CamposCliente, CamposOcultosDireccion, type DatosCliente } from '@/componentes/FormularioCliente';
import { EditorRestricciones } from '@/componentes/EditorRestricciones';
import { editarMiPerfil, guardarMisRestricciones, cambiarMiClaveCliente } from '@/acciones/clientes';
import type { TipoComida, CategoriaAlimento } from '@/generated/prisma/enums';

type Seccion = 'datos' | 'restricciones' | 'clave';

export default function MiPerfilCliente({ slug, email, comidas, datos, restricciones, alimentos }: {
  slug: string; email: string; comidas: TipoComida[]; datos: DatosCliente;
  restricciones: { alimentoId: number; tiposComida: TipoComida[] }[];
  alimentos: { id: number; nombre: string; categoria: CategoriaAlimento }[];
}) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>('datos');
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  return (
    <>
      <CabeceraPagina titulo="Mi perfil" descripcion={email} />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro activo={seccion} alElegir={(v) => setSeccion(v as Seccion)} opciones={[
          { valor: 'datos', etiqueta: 'Mis datos', icono: UserRound },
          { valor: 'restricciones', etiqueta: 'Lo que no como', icono: ShieldAlert, conteo: restricciones.length },
          { valor: 'clave', etiqueta: 'Contraseña', icono: KeyRound },
        ]} />
        <div className="min-w-0 flex-1">
          {seccion === 'datos' && (
            <Tarjeta className="p-5">
              <form action={(d) => arranca(async () => { setError(null); const r = await editarMiPerfil(slug, d); if (!r.ok) return setError(r.error); toast.success('Perfil guardado'); router.refresh(); })} className="space-y-6">
                {/* La dirección se edita en «Mi dirección»; aquí van los campos que no son de entrega. Pero el servidor
                    recibe la ficha entera, así que los de dirección viajan escondidos con su valor actual. */}
                <CamposCliente datos={datos} comidas={comidas} secciones={['personales', 'nutricion']} />
                <CamposOcultosDireccion datos={datos} />
                {error && <Aviso texto={error} />}
                <div className="flex justify-end border-t border-borde pt-4"><Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></div>
              </form>
            </Tarjeta>
          )}
          {seccion === 'restricciones' && (
            <Tarjeta className="p-5">
              <h2 className="text-[14px] font-semibold">Lo que no como</h2>
              <div className="mt-3"><EditorRestricciones alimentos={alimentos} comidas={comidas} inicial={restricciones} guardar={(r) => guardarMisRestricciones(slug, r)} /></div>
            </Tarjeta>
          )}
          {seccion === 'clave' && (
            <Tarjeta className="p-5">
              <h2 className="text-[14px] font-semibold">Cambiar mi contraseña</h2>
              <form id="form-clave" action={(d) => arranca(async () => { setError(null); const r = await cambiarMiClaveCliente(slug, d); if (!r.ok) return setError(r.error); toast.success('Contraseña cambiada'); (document.getElementById('form-clave') as HTMLFormElement | null)?.reset(); })} className="mt-4 max-w-sm space-y-4">
                <Campo etiqueta="Contraseña actual" requerido><Entrada name="actual" type="password" autoComplete="current-password" required /></Campo>
                <Campo etiqueta="Contraseña nueva" requerido><Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} /></Campo>
                {error && <Aviso texto={error} />}
                <Boton type="submit" disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
              </form>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
