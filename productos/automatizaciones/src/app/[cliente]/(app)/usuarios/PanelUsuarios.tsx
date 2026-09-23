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
 * ── LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO ──────────────────────────────────
 * Que hay DOS clases de cuenta y que la diferencia importa, porque decide a quién se
 * le pide la contraseña cuando se le olvida:
 *   · «Cuenta de GCC World» → su contraseña es la de la plataforma; aquí no se toca.
 *   · «Cuenta de este producto» → la contraseña se genera aquí y se enseña UNA vez.
 * Por eso cada fila lleva su marca y el formulario lo explica al elegir.
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
  const [origen, setOrigen] = useState<'GCC' | 'PRODUCTO'>('GCC');
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
      <div className="max-w-4xl px-4 py-5 sm:px-6">

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
                  <Insignia tono="info">
                    <Link2 className="mr-1 inline h-3 w-3" />
                    Cuenta de GCC World
                  </Insignia>
                ) : (
                  <Insignia tono="neutro">
                    <ShieldCheck className="mr-1 inline h-3 w-3" />
                    Cuenta de este producto
                  </Insignia>
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

          <Campo etiqueta="¿Cómo va a entrar?">
            <Selector name="origen" value={origen} onChange={(e) => setOrigen(e.target.value as 'GCC' | 'PRODUCTO')}>
              <option value="GCC">Con su cuenta de GCC World</option>
              <option value="PRODUCTO">Con una cuenta de este producto</option>
            </Selector>
          </Campo>

          <p className="rounded border border-borde bg-realce px-3 py-2 text-[12px] leading-relaxed text-tenue">
            {origen === 'GCC' ? (
              <>
                Entrará con el correo y la contraseña que ya usa en GCC World. Aquí no se
                guarda ninguna contraseña suya, así que si la cambia allí, cambia aquí.
                Hace falta que la cuenta exista ya en la plataforma.
              </>
            ) : (
              <>
                Se le generará una contraseña que verás UNA vez. Úsalo para quien no
                tenga cuenta en GCC World.
              </>
            )}
          </p>

          <Campo etiqueta={origen === 'GCC' ? 'Correo de su cuenta de GCC World' : 'Usuario'}>
            <Entrada
              name="usuario"
              type={origen === 'GCC' ? 'email' : 'text'}
              placeholder={origen === 'GCC' ? 'persona@empresa.com' : 'nombre.apellido'}
              required
            />
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
