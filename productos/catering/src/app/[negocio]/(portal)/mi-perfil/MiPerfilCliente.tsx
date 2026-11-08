'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserRound, ShieldAlert, KeyRound, Save } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Secciones, useSeccion, type OpcionRail } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CamposCliente, CamposOcultosDireccion, type DatosCliente } from '@/componentes/FormularioCliente';
import { EditorRestricciones } from '@/componentes/EditorRestricciones';
import { editarMiPerfil, guardarMisRestricciones, cambiarMiClaveCliente } from '@/acciones/clientes';
import type { TipoComida, CategoriaAlimento } from '@/generated/prisma/enums';

type Seccion = 'datos' | 'restricciones' | 'clave';

/**
 * MI PERFIL del cliente final, con las secciones de Configuración (2026-11-08): raíl + panel
 * derecho hasta abajo en escritorio, portada de secciones en el teléfono y los «Guardar» en la
 * barra de abajo.
 */
export default function MiPerfilCliente({ slug, email, comidas, datos, restricciones, alimentos }: {
  slug: string; email: string; comidas: TipoComida[]; datos: DatosCliente;
  restricciones: { alimentoId: number; tiposComida: TipoComida[] }[];
  alimentos: { id: number; nombre: string; categoria: CategoriaAlimento }[];
}) {
  const router = useRouter();
  const opciones: OpcionRail[] = [
    { valor: 'datos', etiqueta: 'Mis datos', icono: UserRound },
    { valor: 'restricciones', etiqueta: 'Lo que no como', icono: ShieldAlert, conteo: restricciones.length },
    { valor: 'clave', etiqueta: 'Contraseña', icono: KeyRound },
  ];
  const s = useSeccion(opciones);
  const seccion = s.activo as Seccion;
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const guardarTelefono =
    s.enUrl && seccion === 'datos' ? <Boton form="form-perfil" type="submit" icono={Save} disabled={enCurso}>Guardar</Boton>
    : s.enUrl && seccion === 'clave' ? <Boton form="form-clave" type="submit" icono={Save} disabled={enCurso}>Cambiar contraseña</Boton>
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CabeceraPagina titulo="Mi perfil" extra={<span className="text-[12px] text-tenue">{email}</span>}
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Mi perfil' } : undefined}
        accionesTelefono={guardarTelefono} />
      <Secciones opciones={opciones} seccion={s}>
          {seccion === 'datos' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <form id="form-perfil" action={(d) => arranca(async () => { setError(null); const r = await editarMiPerfil(slug, d); if (!r.ok) return setError(r.error); toast.success('Guardado.'); router.refresh(); })} className="space-y-6">
                {/* La dirección se edita en «Mi dirección»; aquí van los campos que no son de entrega. Pero el servidor
                    recibe la ficha entera, así que los de dirección viajan escondidos con su valor actual. */}
                <CamposCliente datos={datos} comidas={comidas} secciones={['personales', 'nutricion']} />
                <CamposOcultosDireccion datos={datos} />
                {error && <Aviso texto={error} />}
                <div className="hidden justify-end lg:flex"><Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></div>
              </form>
            </div>
          )}
          {seccion === 'restricciones' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <EditorRestricciones alimentos={alimentos} comidas={comidas} inicial={restricciones} guardar={(r) => guardarMisRestricciones(slug, r)} />
            </div>
          )}
          {seccion === 'clave' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <form id="form-clave" action={(d) => arranca(async () => { setError(null); const r = await cambiarMiClaveCliente(slug, d); if (!r.ok) return setError(r.error); toast.success('Cambiada.'); (document.getElementById('form-clave') as HTMLFormElement | null)?.reset(); })} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Contraseña actual" requerido><Entrada name="actual" type="password" autoComplete="current-password" required /></Campo>
                  <Campo etiqueta="Contraseña nueva" requerido><Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} /></Campo>
                </div>
                {error && <Aviso texto={error} />}
                <div className="hidden justify-end lg:flex"><Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton></div>
              </form>
            </div>
          )}
      </Secciones>
    </div>
  );
}
