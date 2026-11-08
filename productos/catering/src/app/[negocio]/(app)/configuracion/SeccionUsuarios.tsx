'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Check, Pencil, UserX, UserCheck, Save } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Tabla, Tarjeta, Insignia, PanelLateral, PieAcciones, Confirmar } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { Aviso, Casilla } from '@/componentes/campos';
import { crearUsuario, editarUsuario, restablecerClave } from '@/acciones/usuarios';
import { instante } from '@/lib/fechas';
import { ETIQUETA_ROL as ROL, QUE_HACE_ROL } from '@/lib/permisos';
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

export type Cupo = { tope: number | null; usadas: number; quedan: number | null };

/**
 * LOS USUARIOS DEL NEGOCIO — una sección de Configuración desde el 2026-11-08, como en
 * Automatizaciones (antes, la página «Usuarios»). Tabla con el recuento al pie (el cupo del
 * plan va ahí: enterarse del tope justo cuando estorba es la peor forma de enterarse), acciones
 * de fila en «⋯» y los formularios en el panel lateral con el pie fijo.
 */
export default function SeccionUsuarios({
  slug,
  usuarios,
  yoSoy,
  cupo,
  zonaHoraria,
  abierto,
  setAbierto,
}: {
  slug: string;
  usuarios: UsuarioVista[];
  yoSoy: number;
  cupo: Cupo;
  zonaHoraria: string;
  /** El panel de «Nuevo usuario» lo abre también la barra del teléfono (en Configuración). */
  abierto: boolean;
  setAbierto: (v: boolean) => void;
}) {
  const sinSitio = cupo.quedan !== null && cupo.quedan <= 0;
  const router = useRouter();
  const [editando, setEditando] = useState<UsuarioVista | null>(null);
  const [activoEdit, setActivoEdit] = useState(true);
  const [restableciendo, setRestableciendo] = useState<UsuarioVista | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ usuario: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrarTodo = () => {
    setAbierto(false);
    setEditando(null);
    setRestableciendo(null);
    setError(null);
  };
  const editar = (u: UsuarioVista) => { setError(null); setActivoEdit(u.activo); setEditando(u); };

  /** Activar o desactivar desde el «⋯»: la misma acción de editar, con el resto de datos tal cual. */
  const cambiarActivo = (u: UsuarioVista) =>
    arranca(async () => {
      const d = new FormData();
      d.set('nombre', u.nombre);
      d.set('email', u.email ?? '');
      d.set('rol', u.rol);
      d.set('activo', u.activo ? 'false' : 'true');
      const r = await editarUsuario(slug, u.id, d);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(u.activo ? 'Desactivado.' : 'Activado.');
      router.refresh();
    });

  const opcionesRol = (Object.keys(ROL) as RolUsuario[]).map((r) => (
    <option key={r} value={r} title={QUE_HACE_ROL[r]}>{ROL[r]}</option>
  ));

  return (
    <div className="flex flex-1 flex-col">
      {claveNueva && <AvisoClave dato={claveNueva} alCerrar={() => setClaveNueva(null)} />}

      {/* Sin título: la sección ya se llama «Usuarios». «Nuevo usuario» arriba a la derecha en
          escritorio; en el teléfono va a la barra de abajo (la pone Configuración). */}
      <div className="hidden justify-end px-4 py-3 lg:flex">
        <Boton icono={UserPlus} onClick={() => { setError(null); setAbierto(true); }} disabled={sinSitio}
          title={sinSitio ? `Tu plan permite ${cupo.tope} cuentas activas` : undefined}>
          Nuevo usuario
        </Boton>
      </div>
      <Tabla
        filas={usuarios}
        claveFila={(u) => u.id}
        alPulsarFila={editar}
        recuento={`${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'} · ${cupo.tope === null ? cupo.usadas : `${cupo.usadas} de ${cupo.tope}`} ${cupo.usadas === 1 ? 'activo' : 'activos'}`}
        columnas={[
          { clave: 'nombre', titulo: 'Persona', ancho: '30%', render: (u) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-texto">
                {u.nombre}{u.id === yoSoy && <span className="ml-1 text-[11px] font-normal text-tenue">(tú)</span>}
              </p>
              <p className="truncate text-[11.5px] text-tenue">{u.usuario}</p>
            </div>
          ) },
          { clave: 'email', titulo: 'Correo', ancho: '24%', render: (u) => <span className="block truncate">{u.email || '—'}</span> },
          { clave: 'rol', titulo: 'Rol', ancho: '13%', render: (u) => (
            <Insignia tono={u.rol === 'ADMIN' ? 'info' : u.rol === 'COCINA' ? 'exito' : 'aviso'}>{ROL[u.rol]}</Insignia>
          ) },
          { clave: 'estado', titulo: 'Estado', ancho: '11%', render: (u) => (
            <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia>
          ) },
          { clave: 'acceso', titulo: 'Último acceso', ancho: '16%', render: (u) =>
            u.ultimoAcceso ? instante(u.ultimoAcceso, zonaHoraria) : <span className="text-tenue">Nunca</span> },
          // Acciones de fila = «⋯» siempre (regla 2026-11-08). La que quita el acceso, en rojo y al final.
          { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (u) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <MenuFila
                acciones={[
                  { etiqueta: 'Editar', icono: Pencil, deshabilitado: enCurso, alPulsar: () => editar(u) },
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
        alCerrar={cerrarTodo}
        titulo="Nuevo usuario"
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={cerrarTodo} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-usuario-nuevo" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-usuario-nuevo"
          action={(datos) =>
            arranca(async () => {
              setError(null);
              const r = await crearUsuario(slug, datos);
              if (!r.ok) return setError(r.error);
              if (r.clave) setClaveNueva({ usuario: String(datos.get('usuario') || ''), clave: r.clave });
              toast.success('Creado.');
              cerrarTodo();
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" required autoFocus />
            </Campo>
            <Campo etiqueta="Usuario" requerido>
              <Entrada name="usuario" required placeholder="mesero1" />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" />
            </Campo>
            <Campo etiqueta="Rol" requerido>
              <Selector name="rol" defaultValue="COCINA">{opcionesRol}</Selector>
            </Campo>
            <Campo etiqueta="Contraseña">
              <Entrada name="clave" type="text" placeholder="Se genera sola" />
            </Campo>
          </div>
          {error && <Aviso texto={error} />}
        </form>
      </PanelLateral>

      {/* Edición */}
      <PanelLateral
        abierto={!!editando}
        alCerrar={cerrarTodo}
        titulo={editando?.nombre ?? ''}
        descripcion={editando?.usuario}
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={cerrarTodo} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-usuario-editar" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {editando && (
          <form
            id="form-usuario-editar"
            key={editando.id}
            action={(datos) =>
              arranca(async () => {
                setError(null);
                datos.set('activo', activoEdit ? 'true' : 'false');
                const r = await editarUsuario(slug, editando.id, datos);
                if (!r.ok) return setError(r.error);
                toast.success('Guardado.');
                cerrarTodo();
                router.refresh();
              })
            }
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre" requerido>
                <Entrada name="nombre" defaultValue={editando.nombre} required />
              </Campo>
              <Campo etiqueta="Correo">
                <Entrada name="email" type="email" defaultValue={editando.email ?? ''} />
              </Campo>
              <Campo etiqueta="Rol" requerido>
                <Selector name="rol" defaultValue={editando.rol}>{opcionesRol}</Selector>
              </Campo>
            </div>
            <Casilla etiqueta="Activo" marcado={activoEdit} alCambiar={setActivoEdit} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Confirmar
        abierto={!!restableciendo}
        titulo="¿Nueva contraseña?"
        mensaje={`Se genera una para «${restableciendo?.usuario}» y se muestra una sola vez. La anterior deja de funcionar.`}
        textoAceptar="Generar"
        peligro={false}
        ocupado={enCurso}
        alCerrar={cerrarTodo}
        alAceptar={() =>
          arranca(async () => {
            if (!restableciendo) return;
            const r = await restablecerClave(slug, restableciendo.id);
            if (!r.ok) { toast.error(r.error); return; }
            setClaveNueva({ usuario: restableciendo.usuario, clave: r.clave! });
            cerrarTodo();
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
      <code className="rounded border border-borde bg-realce px-3 py-1.5 font-mono text-[14px] font-semibold text-texto">{dato.clave}</code>
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
      <Boton variante="fantasma" onClick={alCerrar}>Ocultar</Boton>
    </Tarjeta>
  );
}
