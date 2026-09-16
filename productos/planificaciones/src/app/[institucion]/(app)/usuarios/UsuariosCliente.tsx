'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserPlus, KeyRound, Copy, Check } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tabla, Tarjeta, Insignia, PanelLateral, Confirmar } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearUsuario, editarUsuario, restablecerClave } from '@/acciones/usuarios';
import type { RolUsuario } from '@/generated/prisma/enums';
import { ETIQUETA_ROL as ROL, QUE_HACE_ROL as QUE_PUEDE } from '@/lib/permisos';

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
};

/**
 * Las cuentas de la institución. Solo el administrador entra aquí; todas las que
 * crea son PROFESOR (Fernando, 2026-09-15). Cada fila dice cuánto ha planificado
 * esa persona, y desde aquí se salta a ver sus planificaciones.
 */
export default function UsuariosCliente({ slug, usuarios, yoSoy, cupo }: { slug: string; usuarios: UsuarioVista[]; yoSoy: number; cupo: { tope: number | null; usadas: number; quedan: number | null } }) {
  const sinSitio = cupo.quedan !== null && cupo.quedan <= 0;
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<UsuarioVista | null>(null);
  const [restableciendo, setRestableciendo] = useState<UsuarioVista | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ usuario: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrarTodo = () => {
    setCreando(false);
    setEditando(null);
    setRestableciendo(null);
    setError(null);
  };

  return (
    <>
      <CabeceraPagina
        titulo="Usuarios"
        descripcion="Quién entra a la institución. Todas las cuentas nuevas son de profesor."
        acciones={
          <>
            {cupo.tope !== null && <Insignia tono={sinSitio ? 'error' : cupo.quedan !== null && cupo.quedan <= 5 ? 'aviso' : 'neutro'}>{cupo.usadas} de {cupo.tope} cuentas</Insignia>}
            <Boton icono={UserPlus} onClick={() => setCreando(true)} disabled={sinSitio} title={sinSitio ? `Tu plan permite ${cupo.tope} cuentas activas` : undefined}>
              Nueva cuenta
            </Boton>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {claveNueva && <AvisoClave dato={claveNueva} alCerrar={() => setClaveNueva(null)} />}

        <Tarjeta className="overflow-hidden">
          <Tabla
            filas={usuarios}
            claveFila={(u) => u.id}
            alPulsarFila={(u) => setEditando(u)}
            columnas={[
              {
                clave: 'nombre',
                titulo: 'Persona',
                render: (u) => (
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${u.activo ? 'bg-exito' : 'bg-tenue'}`} title={u.activo ? 'Activa' : 'Desactivada'} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{[u.profesion, u.nombre].filter(Boolean).join(' ')}</p>
                      <p className="truncate text-[11px] text-tenue">
                        {u.usuario}
                        {u.id === yoSoy && ' · tú'}
                      </p>
                    </div>
                  </div>
                ),
              },
              { clave: 'email', titulo: 'Correo', render: (u) => u.email || '—' },
              { clave: 'rol', titulo: 'Rol', render: (u) => <Insignia tono={u.rol === 'ADMIN' ? 'info' : 'exito'}>{ROL[u.rol]}</Insignia> },
              {
                clave: 'planifica',
                titulo: 'Planificaciones',
                render: (u) =>
                  u.planificaciones ? (
                    <Link href={`/${slug}/planificaciones?quien=todas&q=${encodeURIComponent(u.nombre)}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-acento hover:underline">
                      {u.planificaciones} · {u.semanas} semana{u.semanas === 1 ? '' : 's'}
                    </Link>
                  ) : (
                    <span className="text-tenue">—</span>
                  ),
              },
              { clave: 'acceso', titulo: 'Último acceso', render: (u) => (u.ultimoAcceso ? format(new Date(u.ultimoAcceso), 'd MMM yyyy, HH:mm', { locale: es }) : <span className="text-tenue">Nunca</span>) },
              {
                clave: 'acciones',
                titulo: '',
                alinear: 'der',
                render: (u) => (
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={KeyRound}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRestableciendo(u);
                    }}
                  >
                    Contraseña
                  </Boton>
                ),
              },
            ]}
          />
        </Tarjeta>

        <Tarjeta className="p-4">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">Qué puede hacer cada rol</h2>
          <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
            {(Object.keys(ROL) as RolUsuario[]).map((r) => (
              <div key={r}>
                <dt className="font-semibold text-texto">{ROL[r]}</dt>
                <dd className="text-tenue">{QUE_PUEDE[r]}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
      </div>

      <PanelLateral abierto={creando} alCerrar={cerrarTodo} titulo="Nueva cuenta de profesor" descripcion="La contraseña se genera sola si la dejas en blanco.">
        <form
          action={(datos) =>
            arranca(async () => {
              setError(null);
              const r = await crearUsuario(slug, datos);
              if (!r.ok) return setError(r.error);
              if (r.clave) setClaveNueva({ usuario: String(datos.get('usuario') || ''), clave: r.clave });
              toast.success('Cuenta creada');
              cerrarTodo();
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
            <Campo etiqueta="Profesión / título">
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
            <Entrada name="clave" type="text" placeholder="Se genera sola si la dejas vacía" />
          </Campo>
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrarTodo} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Creando…' : 'Crear cuenta'}
            </Boton>
          </div>
        </form>
      </PanelLateral>

      <PanelLateral abierto={!!editando} alCerrar={cerrarTodo} titulo="Editar cuenta" descripcion={editando?.usuario}>
        {editando && (
          <form
            action={(datos) =>
              arranca(async () => {
                setError(null);
                const r = await editarUsuario(slug, editando.id, datos);
                if (!r.ok) return setError(r.error);
                toast.success('Cuenta actualizada');
                cerrarTodo();
                router.refresh();
              })
            }
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
              <Campo etiqueta="Profesión / título">
                <Entrada name="profesion" defaultValue={editando.profesion ?? ''} />
              </Campo>
              <Campo etiqueta="Nombre" requerido>
                <Entrada name="nombre" defaultValue={editando.nombre} required />
              </Campo>
            </div>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={editando.email ?? ''} />
            </Campo>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="activo" defaultChecked={editando.activo} className="h-4 w-4 accent-[var(--color-acento)]" />
              Cuenta activa
            </label>
            {error && <Aviso texto={error} />}
            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton type="button" variante="secundario" onClick={cerrarTodo} disabled={enCurso}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </form>
        )}
      </PanelLateral>

      <Confirmar
        abierto={!!restableciendo}
        titulo="Restablecer la contraseña"
        mensaje={`Se generará una contraseña nueva para «${restableciendo?.usuario}» y se mostrará una sola vez. La anterior dejará de funcionar.`}
        textoAceptar="Generar contraseña"
        peligro={false}
        ocupado={enCurso}
        alCerrar={cerrarTodo}
        alAceptar={() =>
          arranca(async () => {
            if (!restableciendo) return;
            const r = await restablecerClave(slug, restableciendo.id);
            if (!r.ok) return void toast.error(r.error);
            setClaveNueva({ usuario: restableciendo.usuario, clave: r.clave! });
            cerrarTodo();
            router.refresh();
          })
        }
      />
    </>
  );
}

/** La contraseña se enseña UNA vez: no se guarda en claro en ningún sitio. */
function AvisoClave({ dato, alCerrar }: { dato: { usuario: string; clave: string }; alCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Tarjeta className="flex flex-wrap items-center gap-3 border-acento bg-acento-suave p-4">
      <KeyRound className="h-5 w-5 shrink-0 text-acento" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-texto">Contraseña de «{dato.usuario}»</p>
        <p className="text-[12px] text-tenue">Se muestra una sola vez. Cópiala y entrégasela a esa persona.</p>
      </div>
      <code className="rounded border border-borde bg-tarjeta px-3 py-1.5 font-mono text-[14px] font-semibold">{dato.clave}</code>
      <Boton
        variante="secundario"
        icono={copiado ? Check : Copy}
        onClick={() => {
          navigator.clipboard.writeText(dato.clave);
          setCopiado(true);
          toast.success('Contraseña copiada');
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
