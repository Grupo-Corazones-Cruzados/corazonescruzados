'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, Check, Pencil, Save } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Insignia, Tarjeta, PanelLateral, Tabla, PieAcciones, Confirmar } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { crearUsuario, editarUsuario, restablecerClave } from '@/acciones/usuarios';
import { ETIQUETA_ROL as ROL, QUE_HACE_ROL } from '@/lib/permisos';
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

/**
 * LOS USUARIOS DEL NEGOCIO — una sección de Configuración desde el 2026-11-08, como en
 * Automatizaciones (antes, la página «Usuarios», que ya solo redirige aquí).
 *
 * ⚠️ Los roles son OFICIOS, no una escalera (`lib/permisos.ts`): lo que puede cada uno va en el
 * `title` de cada opción del selector, no en una nota bajo el campo.
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

  return (
    <div className="flex flex-1 flex-col">
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
          { clave: 'rol', titulo: 'Rol', ancho: '14%', render: (u) => (
            <Insignia tono={u.rol === 'ADMIN' ? 'info' : u.rol === 'MESERO' ? 'neutro' : 'aviso'}>{ROL[u.rol]}</Insignia>
          ) },
          { clave: 'acceso', titulo: 'Último acceso', ancho: '18%', render: (u) =>
            u.ultimoAcceso ? <span className="tabular-nums">{fechaHora(u.ultimoAcceso, zona)}</span> : <span className="text-tenue">Nunca</span> },
          { clave: 'estado', titulo: 'Estado', ancho: '10%', render: (u) => (
            <Insignia tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Insignia>
          ) },
          /* Las acciones de cada cuenta van SIEMPRE en «⋯» (regla de Automatizaciones). */
          { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (u) => (
            <div className="flex justify-end">
              <MenuFila
                acciones={[
                  { etiqueta: 'Editar', icono: Pencil, deshabilitado: enCurso, alPulsar: () => setEditando(u) },
                  { etiqueta: 'Nueva contraseña', icono: KeyRound, deshabilitado: enCurso, alPulsar: () => setRestableciendo(u) },
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
              toast.success('Cuenta creada.');
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
            <Entrada name="usuario" required placeholder="mesero1" />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada name="email" type="email" />
          </Campo>
          <Campo etiqueta="Rol" requerido>
            <SelectorRol defaultValue="MESERO" />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Entrada name="clave" type="text" placeholder="Vacía: se genera sola" />
          </Campo>
        </form>
      </PanelLateral>

      {/* Edición */}
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
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" defaultValue={editando.nombre} required autoFocus />
            </Campo>
            <Campo etiqueta="Usuario">
              <Entrada value={editando.usuario} readOnly disabled />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={editando.email ?? ''} />
            </Campo>
            <Campo etiqueta="Rol" requerido>
              <SelectorRol defaultValue={editando.rol} />
            </Campo>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={editando.activo}
                className="h-4 w-4 accent-[var(--color-acento)]"
              />
              Activo
            </label>
          </form>
        )}
      </PanelLateral>

      <Confirmar
        abierto={!!restableciendo}
        titulo="¿Nueva contraseña?"
        mensaje={`Se genera una contraseña nueva para «${restableciendo?.usuario}» y la anterior deja de funcionar.`}
        textoAceptar="Generar"
        peligro={false}
        ocupado={enCurso}
        alCerrar={() => setRestableciendo(null)}
        alAceptar={() =>
          arranca(async () => {
            if (!restableciendo) return;
            const r = await restablecerClave(slug, restableciendo.id);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            setClaveNueva({ usuario: restableciendo.usuario, clave: r.clave! });
            setRestableciendo(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

/** Los oficios, con lo que puede cada uno en el `title` (sin notas bajo el campo). */
function SelectorRol({ defaultValue }: { defaultValue: RolUsuario }) {
  return (
    <Selector name="rol" defaultValue={defaultValue}>
      {(Object.keys(ROL) as RolUsuario[]).map((r) => (
        <option key={r} value={r} title={QUE_HACE_ROL[r]}>
          {ROL[r]}
        </option>
      ))}
    </Selector>
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
          navigator.clipboard?.writeText(dato.clave).then(
            () => { setCopiado(true); toast.success('Copiada.'); },
            () => toast.error('No se pudo copiar.'),
          );
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
