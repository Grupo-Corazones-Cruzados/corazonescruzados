'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, ShieldCheck, Link2 } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Insignia, Tarjeta, PanelLateral } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { crearUsuario, cambiarActivo, regenerarClave } from '@/acciones/usuarios';

export type UsuarioVista = {
  id: number;
  usuario: string;
  nombre: string;
  rol: 'ADMIN' | 'OPERADOR' | 'CONSULTA';
  origen: 'PRODUCTO' | 'GCC';
  activo: boolean;
  ultimoAcceso: string | null;
  esYo: boolean;
};

const ETIQUETA_ROL = { ADMIN: 'Administrador', OPERADOR: 'Operador', CONSULTA: 'Consulta' } as const;

/**
 * LAS CUENTAS DEL CLIENTE. La pantalla que pidió Fernando el 2026-09-23 para que el
 * dueño del inquilino cree a su gente sin depender de GCC.
 *
 * ── LO QUE SE CREA AQUÍ ES DEL CLIENTE, Y SOLO DEL CLIENTE ──────────────────────
 * Las cuentas que crea el administrador pertenecen a su empresa: su contraseña vive en
 * este producto y no abren absolutamente nada en GCC World. El formulario ya no ofrece
 * elegir (Fernando, 2026-09-24) — ver `acciones/usuarios.ts` para el porqué.
 *
 * Las filas marcadas «Cuenta de GCC World» las enlazó el equipo de GCC y se gobiernan
 * desde `/gcc`; aquí se ven, pero ni se crean ni se les toca la contraseña. Que se vean
 * importa: el administrador tiene que saber quién puede entrar a su empresa.
 */
export default function PanelUsuarios({
  slug,
  usuarios,
  tope,
  activas,
}: {
  slug: string;
  usuarios: UsuarioVista[];
  tope: number | null;
  activas: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enCurso, arranca] = useTransition();
  const [claveNueva, setClaveNueva] = useState<{ texto: string; de: string } | null>(null);

  const lleno = tope !== null && activas >= tope;

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success('Copiado.'),
      () => toast.error('No se pudo copiar; selecciónala a mano.'),
    );
  }

  function crear(datos: FormData) {
    arranca(async () => {
      const r = await crearUsuario(slug, datos);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje ?? 'Cuenta creada.');
      if (r.clave) setClaveNueva({ texto: r.clave, de: String(datos.get('nombre') || '') });
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <>
      <CabeceraPagina
        titulo="Cuentas"
        /* El tope se enseña SIEMPRE, no solo cuando estorba. */
        descripcion={tope === null ? `${activas} cuentas activas` : `${activas} de ${tope} cuentas activas`}
        acciones={
          <Boton
            onClick={() => setAbierto(true)}
            disabled={lleno}
            title={lleno ? `Tu plan permite ${tope} cuentas activas y ya tienes ${activas}.` : undefined}
          >
            <UserPlus className="h-4 w-4" />
            Crear cuenta
          </Boton>
        }
      />
      <div className="px-4 py-5 sm:px-6">

      {claveNueva && (
        <Tarjeta className="mb-3 border-acento p-4">
          <p className="text-[13px] font-medium text-texto">Contraseña de {claveNueva.de}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-tenue">
            Se enseña una sola vez: no se guarda en claro, así que no se puede volver a
            mostrar. Cópiala y dásela ahora.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-borde bg-realce px-2.5 py-2 text-[13px] text-texto">
              {claveNueva.texto}
            </code>
            <Boton variante="secundario" tamano="lg" onClick={() => copiar(claveNueva.texto)}>
              <Copy className="h-4 w-4" />
              Copiar
            </Boton>
          </div>
          <Boton variante="fantasma" className="mt-2" onClick={() => setClaveNueva(null)}>
            Ya la guardé
          </Boton>
        </Tarjeta>
      )}

      <Tarjeta className="divide-y divide-borde">
        {usuarios.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-texto">
                <span className="truncate">{u.nombre}</span>
                {u.esYo && <span className="text-[11px] font-normal text-tenue">(tú)</span>}
              </p>
              <p className="truncate text-[11.5px] text-tenue">{u.usuario}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5">
                <Insignia tono={u.rol === 'ADMIN' ? 'info' : 'neutro'}>{ETIQUETA_ROL[u.rol]}</Insignia>
                {u.origen === 'GCC' ? (
                  <Insignia tono="info" icono={Link2}>Cuenta de GCC World</Insignia>
                ) : (
                  <Insignia tono="neutro" icono={ShieldCheck}>Cuenta de este producto</Insignia>
                )}
                {!u.activo && <Insignia tono="error">Desactivada</Insignia>}
              </p>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              {u.origen === 'PRODUCTO' && (
                <Boton
                  variante="secundario"
                  tamano="lg"
                  className="flex-1 sm:flex-none"
                  disabled={enCurso}
                  onClick={() =>
                    arranca(async () => {
                      const r = await regenerarClave(slug, u.id);
                      if (!r.ok) { toast.error(r.error); return; }
                      if (r.clave) setClaveNueva({ texto: r.clave, de: u.nombre });
                      router.refresh();
                    })
                  }
                >
                  <KeyRound className="h-4 w-4" />
                  Contraseña
                </Boton>
              )}
              {!u.esYo && (
                <Boton
                  variante={u.activo ? 'peligro' : 'secundario'}
                  tamano="lg"
                  className="flex-1 sm:flex-none"
                  disabled={enCurso}
                  onClick={() =>
                    arranca(async () => {
                      const r = await cambiarActivo(slug, u.id, !u.activo);
                      if (!r.ok) { toast.error(r.error); return; }
                      toast.success(r.mensaje ?? 'Hecho.');
                      router.refresh();
                    })
                  }
                >
                  {u.activo ? 'Desactivar' : 'Activar'}
                </Boton>
              )}
            </div>
          </div>
        ))}
      </Tarjeta>

      <PanelLateral abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Crear una cuenta">
        <form action={crear} className="space-y-3">
          <Campo etiqueta="Nombre de la persona">
            <Entrada name="nombre" required autoFocus />
          </Campo>

          <p className="rounded border border-borde bg-realce px-3 py-2 text-[12px] leading-relaxed text-tenue">
            Se le generará una contraseña que verás <strong>una sola vez</strong>. Es una cuenta
            de tu empresa dentro de este producto: no da acceso a GCC World ni a ningún otro
            sitio.
          </p>

          <Campo etiqueta="Usuario">
            <Entrada name="usuario" type="text" placeholder="nombre.apellido" required />
          </Campo>

          <Campo etiqueta="Qué puede hacer">
            <Selector name="rol" defaultValue="OPERADOR">
              <option value="CONSULTA">Consulta — mira, no escribe</option>
              <option value="OPERADOR">Operador — atiende conversaciones y campañas</option>
              <option value="ADMIN">Administrador — además gobierna cuentas y suscripción</option>
            </Selector>
          </Campo>

          <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>
            {enCurso ? 'Creando…' : 'Crear cuenta'}
          </Boton>
        </form>
      </PanelLateral>
      </div>
    </>
  );
}
