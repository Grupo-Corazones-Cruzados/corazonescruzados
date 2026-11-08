'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Check, Pencil, UserX, UserCheck, Save } from 'lucide-react';
import { Boton, Campo, Entrada, Tabla, Tarjeta, Insignia, PanelLateral, Confirmar, PieAcciones } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { crearUsuario, editarUsuario, restablecerClave } from '@/acciones/usuarios';
import { fechaHora } from '@/lib/formato';
import type { RolUsuario } from '@/generated/prisma/enums';
import { ETIQUETA_ROL as ROL, QUE_HACE_ROL } from '@/lib/permisos';

export type UsuarioVista = {
  id: number;
  usuario: string;
  nombre: string;
  profesion: string | null;
  email: string | null;
  rol: RolUsuario;
  activo: boolean;
  planificaciones: number;
  semanas: number;
  ultimoAcceso: string | null;
  esYo: boolean;
};

export type Cupo = { tope: number | null; usadas: number; quedan: number | null };

/**
 * LAS CUENTAS DE LA INSTITUCIÓN — una sección de Configuración desde el 2026-11-08 (antes, el
 * módulo «Usuarios»), como en Automatizaciones. Solo el administrador entra aquí; todas las que
 * crea son PROFESOR (Fernando, 2026-09-15). Cada fila dice cuánto ha planificado esa persona, y
 * desde ahí se salta a ver sus planificaciones. Las acciones de la fila, en el «⋯».
 */
export default function SeccionUsuarios({
  slug,
  usuarios,
  cupo,
  abierto,
  setAbierto,
}: {
  slug: string;
  usuarios: UsuarioVista[];
  cupo: Cupo;
  /** El panel de «Nueva cuenta» lo abre también la barra del teléfono (en Configuración). */
  abierto: boolean;
  setAbierto: (v: boolean) => void;
}) {
  const sinSitio = cupo.quedan !== null && cupo.quedan <= 0;
  const router = useRouter();
  const [editando, setEditando] = useState<UsuarioVista | null>(null);
  const [restableciendo, setRestableciendo] = useState<UsuarioVista | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ usuario: string; clave: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  /** Activar o desactivar desde el «⋯»: el mismo `editarUsuario`, con los datos de la fila. */
  const cambiarActivo = (u: UsuarioVista) =>
    arranca(async () => {
      const d = new FormData();
      d.set('nombre', u.nombre);
      d.set('profesion', u.profesion ?? '');
      d.set('email', u.email ?? '');
      d.set('activo', u.activo ? 'false' : 'true');
      const r = await editarUsuario(slug, u.id, d);
      if (!r.ok) return void toast.error(r.error);
      toast.success(u.activo ? 'Desactivada.' : 'Activada.');
      router.refresh();
    });

  const activas = usuarios.filter((u) => u.activo).length;

  return (
    <div className="flex flex-1 flex-col">
      {claveNueva && <AvisoClave dato={claveNueva} alCerrar={() => setClaveNueva(null)} />}

      {/* Sin título: la sección ya se llama «Usuarios». La principal, arriba a la derecha en
          escritorio y en la barra de abajo en el teléfono (la pone Configuración). */}
      <div className="hidden items-center justify-end gap-2 px-4 py-3 lg:flex">
        <Boton icono={UserPlus} onClick={() => setAbierto(true)} disabled={sinSitio} title={sinSitio ? `Tu plan permite ${cupo.tope} cuentas activas` : undefined}>
          Nueva cuenta
        </Boton>
      </div>
      <div>
        <Tabla
          filas={usuarios}
          claveFila={(u) => u.id}
          alPulsarFila={(u) => setEditando(u)}
          recuento={`${usuarios.length} ${usuarios.length === 1 ? 'cuenta' : 'cuentas'} · ${cupo.tope === null ? activas : `${cupo.usadas} de ${cupo.tope}`} ${activas === 1 ? 'activa' : 'activas'}`}
          columnas={[
            {
              clave: 'nombre',
              titulo: 'Persona',
              ancho: '28%',
              render: (u) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-texto">
                    {[u.profesion, u.nombre].filter(Boolean).join(' ')}
                    {u.esYo && <span className="ml-1 text-[11px] font-normal text-tenue">(tú)</span>}
                  </p>
                  <p className="truncate text-[11.5px] text-tenue">{u.usuario}</p>
                </div>
              ),
            },
            { clave: 'email', titulo: 'Correo', ancho: '22%', render: (u) => <span className="block truncate">{u.email || '—'}</span> },
            {
              clave: 'rol',
              titulo: 'Rol',
              ancho: '13%',
              render: (u) => (
                <span title={QUE_HACE_ROL[u.rol]}>
                  <Insignia tono={u.rol === 'ADMIN' ? 'info' : 'neutro'}>{ROL[u.rol]}</Insignia>
                </span>
              ),
            },
            {
              clave: 'planifica',
              titulo: 'Planificaciones',
              ancho: '14%',
              render: (u) =>
                u.planificaciones ? (
                  <Link href={`/${slug}/planificaciones?quien=todas&q=${encodeURIComponent(u.nombre)}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-acento hover:underline">
                    {u.planificaciones} · {u.semanas} sem.
                  </Link>
                ) : (
                  <span className="text-tenue">—</span>
                ),
            },
            { clave: 'acceso', titulo: 'Último acceso', ancho: '15%', render: (u) => (u.ultimoAcceso ? <span className="text-tenue">{fechaHora(u.ultimoAcceso)}</span> : <span className="text-tenue">Nunca</span>) },
            { clave: 'estado', titulo: 'Estado', ancho: '10%', render: (u) => <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activa' : 'Inactiva'}</Insignia> },
            {
              clave: 'acciones',
              titulo: '',
              ancho: '56px',
              alinear: 'der',
              render: (u) => (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <MenuFila
                    acciones={[
                      { etiqueta: 'Editar', icono: Pencil, deshabilitado: enCurso, alPulsar: () => setEditando(u) },
                      { etiqueta: 'Nueva contraseña', icono: KeyRound, deshabilitado: enCurso, alPulsar: () => setRestableciendo(u) },
                      // La que quita el acceso, en rojo y al final. Tu propia cuenta no se desactiva.
                      ...(!u.esYo
                        ? [{ etiqueta: u.activo ? 'Desactivar' : 'Activar', icono: u.activo ? UserX : UserCheck, peligro: u.activo, deshabilitado: enCurso, alPulsar: () => cambiarActivo(u) }]
                        : []),
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <PanelLateral
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Nueva cuenta de profesor"
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-cuenta" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear cuenta'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-cuenta"
          action={(datos) =>
            arranca(async () => {
              const r = await crearUsuario(slug, datos);
              if (!r.ok) return void toast.error(r.error);
              if (r.clave) setClaveNueva({ usuario: String(datos.get('usuario') || ''), clave: r.clave });
              toast.success('Cuenta creada.');
              setAbierto(false);
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
            <Campo etiqueta="Título">
              <Entrada name="profesion" placeholder="Lcda." />
            </Campo>
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" required autoFocus />
            </Campo>
          </div>
          <Campo etiqueta="Usuario" requerido>
            <Entrada name="usuario" required placeholder="helen.cardenas" />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada name="email" type="email" />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Entrada name="clave" type="text" placeholder="Vacía: se genera sola" />
          </Campo>
        </form>
      </PanelLateral>

      <PanelLateral
        abierto={!!editando}
        alCerrar={() => setEditando(null)}
        titulo={editando ? [editando.profesion, editando.nombre].filter(Boolean).join(' ') : ''}
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-editar-cuenta" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {editando && (
          <form
            id="form-editar-cuenta"
            key={editando.id}
            action={(datos) =>
              arranca(async () => {
                const r = await editarUsuario(slug, editando.id, datos);
                if (!r.ok) return void toast.error(r.error);
                toast.success('Guardado.');
                setEditando(null);
                router.refresh();
              })
            }
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
              <Campo etiqueta="Título">
                <Entrada name="profesion" defaultValue={editando.profesion ?? ''} />
              </Campo>
              <Campo etiqueta="Nombre" requerido>
                <Entrada name="nombre" defaultValue={editando.nombre} required />
              </Campo>
            </div>
            <Campo etiqueta="Usuario">
              <Entrada value={editando.usuario} readOnly disabled />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={editando.email ?? ''} />
            </Campo>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="activo" defaultChecked={editando.activo} disabled={editando.esYo} className="h-4 w-4 accent-[var(--color-acento)]" />
              Cuenta activa
              {/* Una casilla desactivada no se envía: la propia cuenta sigue activa. */}
              {editando.esYo && <input type="hidden" name="activo" value="true" />}
            </label>
          </form>
        )}
      </PanelLateral>

      <Confirmar
        abierto={!!restableciendo}
        titulo="Nueva contraseña"
        mensaje={`Se generará una contraseña nueva para «${restableciendo?.usuario}» y se enseñará una sola vez. La anterior dejará de funcionar.`}
        textoAceptar="Generar"
        peligro={false}
        ocupado={enCurso}
        alCerrar={() => setRestableciendo(null)}
        alAceptar={() =>
          arranca(async () => {
            if (!restableciendo) return;
            const r = await restablecerClave(slug, restableciendo.id);
            if (!r.ok) return void toast.error(r.error);
            setClaveNueva({ usuario: restableciendo.usuario, clave: r.clave! });
            setRestableciendo(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

/** La contraseña se enseña UNA vez: no se guarda en claro en ningún sitio. */
function AvisoClave({ dato, alCerrar }: { dato: { usuario: string; clave: string }; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Tarjeta className="m-4 mb-0 flex flex-wrap items-center gap-3 border-acento p-4">
      <KeyRound className="h-5 w-5 shrink-0 text-acento" />
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-texto" title="Se enseña una sola vez: cópiala y entrégasela a esa persona.">
        Contraseña de «{dato.usuario}»
      </p>
      <code className="rounded border border-borde bg-realce px-3 py-1.5 font-mono text-[14px] font-semibold">{dato.clave}</code>
      <Boton
        variante="secundario"
        icono={copiado ? Check : Copy}
        onClick={() => {
          navigator.clipboard.writeText(dato.clave);
          setCopiado(true);
          toast.success('Copiada.');
        }}
      >
        {copiado ? 'Copiada' : 'Copiar'}
      </Boton>
      <Boton variante="fantasma" onClick={alCerrar}>
        Ocultar
      </Boton>
    </Tarjeta>
  );
}
