'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tarjeta } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { guardarPerfil, cambiarMiClave } from '@/acciones/perfil';
import { ETIQUETA_ROL } from '@/lib/permisos';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * Mi perfil. La PROFESIÓN es la que sale en la casilla «Docente» del formato,
 * delante del nombre (Fernando, 2026-09-15: «ese campo se debe traer automático
 * en el campo docente del formato»).
 */
export default function PerfilCliente({ slug, perfil }: { slug: string; perfil: { usuario: string; nombre: string; profesion: string | null; email: string | null; rol: RolUsuario } }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  return (
    <>
      <CabeceraPagina titulo="Mi perfil" descripcion={`${perfil.usuario} · ${ETIQUETA_ROL[perfil.rol]}`} />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <Tarjeta className="p-5">
          <h2 className="mb-1 text-[14px] font-semibold">Mis datos</h2>
          <p className="mb-4 text-[12px] text-tenue">Así sales en el formato: «{[perfil.profesion, perfil.nombre].filter(Boolean).join(' ')}».</p>
          <form
            action={(d) =>
              arranca(async () => {
                setError(null);
                const r = await guardarPerfil(slug, d);
                if (!r.ok) return setError(r.error);
                toast.success('Perfil guardado');
                router.refresh();
              })
            }
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <Campo etiqueta="Profesión / título">
                <Entrada name="profesion" defaultValue={perfil.profesion ?? ''} placeholder="Lcda." />
              </Campo>
              <Campo etiqueta="Nombre" requerido>
                <Entrada name="nombre" defaultValue={perfil.nombre} required />
              </Campo>
            </div>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={perfil.email ?? ''} />
            </Campo>
            {error && <Aviso texto={error} />}
            <div className="flex justify-end">
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        <Tarjeta className="p-5">
          <h2 className="mb-4 text-[14px] font-semibold">Cambiar mi contraseña</h2>
          <form
            action={(d) =>
              arranca(async () => {
                setErrorClave(null);
                const r = await cambiarMiClave(slug, d);
                if (!r.ok) return setErrorClave(r.error);
                toast.success('Contraseña cambiada');
                (document.getElementById('form-clave') as HTMLFormElement | null)?.reset();
              })
            }
            id="form-clave"
            className="space-y-4"
          >
            <Campo etiqueta="Contraseña actual" requerido>
              <Entrada name="actual" type="password" autoComplete="current-password" required />
            </Campo>
            <Campo etiqueta="Contraseña nueva (mínimo 8 caracteres)" requerido>
              <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} />
            </Campo>
            {errorClave && <Aviso texto={errorClave} />}
            <div className="flex justify-end">
              <Boton type="submit" variante="secundario" disabled={enCurso}>
                {enCurso ? 'Cambiando…' : 'Cambiar contraseña'}
              </Boton>
            </div>
          </form>
        </Tarjeta>
      </div>
    </>
  );
}
