'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Check, Pencil, UserX, UserCheck, Save } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Tabla, Tarjeta, Insignia, PanelLateral, PieAcciones, Confirmar } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { crearUsuario, editarUsuario, restablecerClave } from '@/acciones/usuarios';
import { fechaHora } from '@/lib/formato';
import type { RolUsuario } from '@/generated/prisma/enums';

export type UsuarioVista = {
  id: number;
  usuario: string;
  nombre: string;
  email: string | null;
  rol: RolUsuario;
  activo: boolean;
  ultimoAcceso: string | null;
};

const ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CONSULTA: 'Consulta',
};

/** Lo que puede cada permiso va en la propia opción, no en una tarjeta de ayuda aparte. */
const OPCION_ROL: Record<RolUsuario, string> = {
  CONSULTA: 'Consulta — mira, no modifica',
  GERENTE: 'Gerente — reservas y reportes',
  ADMIN: 'Administrador — además usuarios y configuración',
};

/**
 * LOS USUARIOS DEL ALOJAMIENTO — una sección de Configuración desde el 2026-11-08, como en
 * Automatizaciones (Fernando: «que desde allí se pueda administrar los usuarios de la
 * organización y quitemos el módulo de usuarios»). Antes era la página «Usuarios».
 *
 * Tabla con el recuento (y el cupo del plan) al pie; las acciones de cada fila en el «⋯»;
 * «Crear usuario» arriba a la derecha en escritorio y en la barra de abajo en el teléfono.
 */
export default function SeccionUsuarios({
  slug,
  zona,
  usuarios,
  yoSoy,
  cupo,
  abierto,
  setAbierto,
}: {
  slug: string;
  zona: string;
  usuarios: UsuarioVista[];
  yoSoy: number;
  /** Cuentas ACTIVAS usadas y el tope del plan (null = sin límite). */
  cupo: { tope: number | null; usadas: number; quedan: number | null };
  /** El panel de «Crear usuario» lo abre también la barra del teléfono (en Configuración). */
  abierto: boolean;
  setAbierto: (v: boolean) => void;
}) {
  const router = useRouter();
  const sinSitio = cupo.quedan !== null && cupo.quedan <= 0;
  const [editando, setEditando] = useState<UsuarioVista | null>(null);
  const [restableciendo, setRestableciendo] = useState<UsuarioVista | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ usuario: string; clave: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  const activos = usuarios.filter((u) => u.activo).length;

  /** Activar o desactivar desde el «⋯»: la misma acción de editar, con los datos de la fila. */
  function cambiarActivo(u: UsuarioVista) {
    const d = new FormData();
    d.set('nombre', u.nombre);
    d.set('email', u.email ?? '');
    d.set('rol', u.rol);
    d.set('activo', u.activo ? 'false' : 'true');
    arranca(async () => {
      const r = await editarUsuario(slug, u.id, d);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(u.activo ? 'Desactivado.' : 'Activado.');
      router.refresh();
    });
  }

  return (
    <div>
      {claveNueva && <AvisoClave dato={claveNueva} alCerrar={() => setClaveNueva(null)} />}

      {/* Sin título: la sección ya se llama «Usuarios». El cupo va en el recuento del pie. */}
      <div className="hidden justify-end px-4 py-3 lg:flex">
        <Boton
          icono={UserPlus}
          onClick={() => setAbierto(true)}
          disabled={sinSitio}
          title={sinSitio ? `Tu plan permite ${cupo.tope} cuentas activas` : undefined}
        >
          Crear usuario
        </Boton>
      </div>
      <Tabla
        filas={usuarios}
        claveFila={(u) => u.id}
        alPulsarFila={(u) => setEditando(u)}
        recuento={`${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'} · ${cupo.tope === null ? activos : `${cupo.usadas} de ${cupo.tope}`} ${activos === 1 ? 'activo' : 'activos'}`}
        columnas={[
          { clave: 'nombre', titulo: 'Persona', ancho: '28%', render: (u) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-texto">
                {u.nombre}{u.id === yoSoy && <span className="ml-1 text-[11px] font-normal text-tenue">(tú)</span>}
              </p>
              <p className="truncate text-[11.5px] text-tenue">{u.usuario}</p>
            </div>
          ) },
          { clave: 'email', titulo: 'Correo', ancho: '24%', render: (u) => <span className="block truncate">{u.email || '—'}</span> },
          { clave: 'rol', titulo: 'Permisos', ancho: '15%', render: (u) => (
            <Insignia tono={u.rol === 'ADMIN' ? 'info' : 'neutro'}>{ROL[u.rol]}</Insignia>
          ) },
          { clave: 'estado', titulo: 'Estado', ancho: '11%', render: (u) => (
            <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia>
          ) },
          { clave: 'acceso', titulo: 'Último acceso', ancho: '16%', render: (u) =>
            u.ultimoAcceso ? <span className="tabular-nums">{fechaHora(u.ultimoAcceso, zona)}</span> : <span className="text-tenue">Nunca</span> },
          /* Acciones de fila = «⋯» siempre (regla 2026-11-08). La que quita el acceso, en rojo y al final. */
          { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (u) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <MenuFila
                acciones={[
                  { etiqueta: 'Editar', icono: Pencil, deshabilitado: enCurso, alPulsar: () => setEditando(u) },
                  { etiqueta: 'Nueva contraseña', icono: KeyRound, deshabilitado: enCurso, alPulsar: () => setRestableciendo(u) },
                  ...(u.id !== yoSoy
                    ? [{
                        etiqueta: u.activo ? 'Desactivar' : 'Activar',
                        icono: u.activo ? UserX : UserCheck,
                        peligro: u.activo,
                        deshabilitado: enCurso,
                        alPulsar: () => cambiarActivo(u),
                      }]
                    : []),
                ]}
              />
            </div>
          ) },
        ]}
      />

      {/* Alta */}
      <PanelLateral
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Crear un usuario"
        pie={
          <PieAcciones>
            <Boton variante="secundario" type="button" onClick={() => setAbierto(false)} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-cuenta" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear usuario'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-cuenta"
          action={(datos) =>
            arranca(async () => {
              const r = await crearUsuario(slug, datos);
              if (!r.ok) { toast.error(r.error); return; }
              if (r.clave) setClaveNueva({ usuario: String(datos.get('usuario') || ''), clave: r.clave });
              toast.success('Usuario creado.');
              setAbierto(false);
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus />
          </Campo>
          <Campo etiqueta="Usuario" requerido>
            <Entrada name="usuario" required placeholder="recepcion" />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada name="email" type="email" />
          </Campo>
          <Campo etiqueta="Permisos" requerido>
            <Selector name="rol" defaultValue="CONSULTA">
              {(['CONSULTA', 'GERENTE', 'ADMIN'] as RolUsuario[]).map((r) => (
                <option key={r} value={r}>{OPCION_ROL[r]}</option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Contraseña">
            <Entrada name="clave" type="text" placeholder="Vacía: se genera sola" />
          </Campo>
        </form>
      </PanelLateral>

      {/* Edición. El estado se cambia desde el «⋯»: aquí viaja tal cual está. */}
      <PanelLateral
        abierto={!!editando}
        alCerrar={() => setEditando(null)}
        titulo={editando?.nombre ?? ''}
        pie={
          <PieAcciones>
            <Boton variante="secundario" type="button" onClick={() => setEditando(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-editar-usuario" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {editando && (
          <form
            id="form-editar-usuario"
            key={editando.id}
            action={(datos) =>
              arranca(async () => {
                const r = await editarUsuario(slug, editando.id, datos);
                if (!r.ok) { toast.error(r.error); return; }
                toast.success('Guardado.');
                setEditando(null);
                router.refresh();
              })
            }
            className="space-y-3"
          >
            <input type="hidden" name="activo" value={editando.activo ? 'true' : 'false'} />
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" defaultValue={editando.nombre} required autoFocus />
            </Campo>
            <Campo etiqueta="Usuario">
              <Entrada value={editando.usuario} readOnly disabled />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={editando.email ?? ''} />
            </Campo>
            <Campo etiqueta="Permisos" requerido>
              <Selector name="rol" defaultValue={editando.rol}>
                {(['CONSULTA', 'GERENTE', 'ADMIN'] as RolUsuario[]).map((r) => (
                  <option key={r} value={r}>{ROL[r]}</option>
                ))}
              </Selector>
            </Campo>
          </form>
        )}
      </PanelLateral>

      <Confirmar
        abierto={!!restableciendo}
        titulo="Nueva contraseña"
        mensaje={`Se generará una contraseña nueva para «${restableciendo?.usuario}» y se mostrará una sola vez. La anterior dejará de funcionar.`}
        textoAceptar="Generar"
        peligro={false}
        ocupado={enCurso}
        alCerrar={() => setRestableciendo(null)}
        alAceptar={() =>
          arranca(async () => {
            if (!restableciendo) return;
            const r = await restablecerClave(slug, restableciendo.id);
            if (!r.ok) { toast.error(r.error); return; }
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
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-texto" title="Se muestra una sola vez">
        Contraseña de «{dato.usuario}»
      </p>
      <code className="rounded border border-borde bg-realce px-3 py-1.5 font-mono text-[14px] font-semibold text-texto">
        {dato.clave}
      </code>
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
        Ya la guardé
      </Boton>
    </Tarjeta>
  );
}
