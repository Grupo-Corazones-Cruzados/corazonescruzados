'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, KeyRound, Copy, ShieldCheck, Link2, UserX, UserCheck, Save } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Insignia, Tarjeta, PanelLateral, Tabla, PieAcciones } from '@/componentes/ui';
import { CabeceraPagina, AccionesTarjeta } from '@/componentes/Navegacion';
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
      {/*
        «Crear cuenta» es la PRINCIPAL de la pantalla: en el teléfono va a la barra de abajo.
        El tope es INFORMACIÓN, no un botón: va en `extra`, bajo el título, en todos los anchos.
      */}
      <CabeceraPagina
        titulo="Cuentas"
        descripcion="Quién entra a tu empresa y con qué permisos. Las cuentas que creas aquí son de tu empresa: su contraseña se genera al crearla, se enseña una sola vez y no da acceso a GCC World."
        /* El tope se enseña SIEMPRE, no solo cuando estorba. */
        extra={
          <Insignia tono={lleno ? 'error' : 'neutro'}>
            {tope === null ? `${activas} cuentas activas` : `${activas} de ${tope} cuentas activas`}
          </Insignia>
        }
        acciones={
          <Boton
            icono={UserPlus}
            onClick={() => setAbierto(true)}
            disabled={lleno}
            title={lleno ? `Tu plan permite ${tope} cuentas activas y ya tienes ${activas}.` : undefined}
          >
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

      {/* Registros en TABLA (galería en el teléfono) con el recuento al pie (reglas 2026-10-29/30). */}
      <Tarjeta className="overflow-hidden">
        <Tabla
          filas={usuarios}
          claveFila={(u) => u.id}
          recuento={`${usuarios.length} ${usuarios.length === 1 ? 'cuenta' : 'cuentas'} · ${activas} ${activas === 1 ? 'activa' : 'activas'}`}
          columnas={[
            { clave: 'nombre', titulo: 'Persona', ancho: '30%', render: (u) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-texto">
                  {u.nombre}{u.esYo && <span className="ml-1 text-[11px] font-normal text-tenue">(tú)</span>}
                </p>
                <p className="truncate text-[11.5px] text-tenue">{u.usuario}</p>
              </div>
            ) },
            { clave: 'rol', titulo: 'Rol', ancho: '15%', render: (u) => (
              <Insignia tono={u.rol === 'ADMIN' ? 'info' : 'neutro'}>{ETIQUETA_ROL[u.rol]}</Insignia>
            ) },
            { clave: 'origen', titulo: 'Cuenta', ancho: '22%', render: (u) => u.origen === 'GCC'
              ? <Insignia tono="info" icono={Link2}>De GCC World</Insignia>
              : <Insignia tono="neutro" icono={ShieldCheck}>De este producto</Insignia> },
            { clave: 'estado', titulo: 'Estado', ancho: '13%', render: (u) => (
              <Insignia tono={u.activo ? 'exito' : 'error'}>{u.activo ? 'Activa' : 'Desactivada'}</Insignia>
            ) },
            /* Las acciones de cada cuenta son SECUNDARIAS: botones desde `lg` y «⋯» en el
               teléfono. La que quita el acceso va en rojo y al final. Tu propia cuenta de GCC
               World no tiene ninguna. */
            { clave: 'acciones', titulo: '', alinear: 'der', render: (u) => (u.origen === 'PRODUCTO' || !u.esYo) ? (
              <div className="flex justify-end">
                <AccionesTarjeta
                  acciones={[
                    ...(u.origen === 'PRODUCTO'
                      ? [{
                          etiqueta: 'Nueva contraseña',
                          icono: KeyRound,
                          deshabilitado: enCurso,
                          alPulsar: () =>
                            arranca(async () => {
                              const r = await regenerarClave(slug, u.id);
                              if (!r.ok) { toast.error(r.error); return; }
                              if (r.clave) setClaveNueva({ texto: r.clave, de: u.nombre });
                              router.refresh();
                            }),
                        }]
                      : []),
                    ...(!u.esYo
                      ? [{
                          etiqueta: u.activo ? 'Desactivar' : 'Activar',
                          icono: u.activo ? UserX : UserCheck,
                          peligro: u.activo,
                          deshabilitado: enCurso,
                          alPulsar: () =>
                            arranca(async () => {
                              const r = await cambiarActivo(slug, u.id, !u.activo);
                              if (!r.ok) { toast.error(r.error); return; }
                              toast.success(r.mensaje ?? 'Hecho.');
                              router.refresh();
                            }),
                        }]
                      : []),
                  ]}
                />
              </div>
            ) : null },
          ]}
        />
      </Tarjeta>

      <PanelLateral
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Crear una cuenta"
        pie={
          <PieAcciones>
            <Boton variante="secundario" type="button" onClick={() => setAbierto(false)} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-cuenta" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear cuenta'}</Boton>
          </PieAcciones>
        }
      >
        <form id="form-cuenta" action={crear} className="space-y-3">
          <Campo etiqueta="Nombre de la persona">
            <Entrada name="nombre" required autoFocus />
          </Campo>
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
        </form>
      </PanelLateral>
      </div>
    </>
  );
}
