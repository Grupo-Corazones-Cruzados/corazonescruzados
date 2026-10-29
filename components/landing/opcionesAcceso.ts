'use client';

/**
 * LAS OPCIONES DE ACCESO — definición ÚNICA (Fernando, 2026-10-26).
 *
 * Qué opciones ve un visitante para entrar y en qué estado: postularse como candidato (o, si
 * ya se postuló desde este dispositivo, «en revisión» / «aprobada»), «Soy candidato», «Soy
 * cliente» (o «verificación pendiente») e «Ingresar como miembro». Lo consultan
 * `/api/candidate/proposal` y `/api/client/status`.
 *
 * Vivía dentro de `EntryChoiceModal`. Se sacó aquí cuando la portada pasó a mostrar las
 * mismas opciones como TARJETAS con el tema del mundo elegido (`RolesMundo`): las dos
 * superficies pintan esta lista, así que no pueden separarse. «Un control que ya existe se
 * usa o se extrae, nunca se reescribe parecido.»
 *
 * ── LA LISTA NO CAMBIA DE FORMA (Fernando, 2026-10-26) ─────────────────────────
 * Siempre salen las MISMAS cuatro opciones, en el mismo orden: mientras se consulta el
 * estado, la opción ya está con su título; al llegar la respuesta cambia
 * su contenido, no su sitio. (Desde el 2026-10-28, si ya te postulaste o ya tienes cuenta de
 * candidato, la tarjeta de postulación se quita: Fernando.)
 */

import type { ComponentType } from 'react';
import { horaDeReanudacion, useEstadoRegistro } from './estadoRegistro';
import { Briefcase, Clock, LogIn, ShieldCheck, UserPlus } from 'lucide-react';

export type TonoOpcion = 'default' | 'success' | 'warning';

export interface AccionesAcceso {
  onCandidate: () => void;
  onCandidateLogin: () => void;
  onClient: () => void;
  onMember: () => void;
  onProposalPending: (info: { email?: string | null; emailVerified?: boolean }) => void;
  /** La postulación ya fue APROBADA por el admin → continuar a crear cuenta. */
  onProposalApproved: (info: { email?: string | null }) => void;
  /** Cliente con cuenta no verificada → mostrar "requiere verificación". */
  onClientPending: (info: { email?: string | null }) => void;
}

export interface OpcionAcceso {
  clave: 'candidato' | 'soy-candidato' | 'cliente' | 'miembro';
  /** «nuevo» = la postulación; «cuenta» = quien ya tiene cuenta. */
  grupo: 'nuevo' | 'cuenta';
  /** En pausa (un registro desde este equipo en las últimas 24 h): se pinta, sin poder pulsarse. */
  pausada?: boolean;
  tono: TonoOpcion;
  Icono: ComponentType<{ className?: string }>;
  insignia?: string;
  titulo: string;
  descripcion: string;
  /** Versión corta para el teléfono (tarjetas estrechas). */
  corta?: string;
  onClick: () => void;
}

/**
 * Nombre del destino, con su preposición — de aquí sale en TODO el acceso (Fernando,
 * 2026-08-17): «a la Plataforma» / «al Videojuego». `dest` va en infinitivo («iniciar sesión
 * y entrar a la Plataforma»); `aDestino`, sin verbo, para las frases en imperativo.
 */
export function nombresDestino(destination: 'game' | 'dashboard') {
  const destino =
    destination === 'dashboard'
      ? { preposicion: 'a la', palabra: 'Plataforma' }
      : { preposicion: 'al', palabra: 'Videojuego' };
  const aDestino = `${destino.preposicion} ${destino.palabra}`;
  return { destino, aDestino, dest: `entrar ${aDestino}` };
}

/**
 * ⭐ 2026-10-29 (Fernando): LAS TARJETAS YA NO RECONOCEN EL EQUIPO.
 *
 * Antes, por la IP o una cookie, la tarjeta de Postulación desaparecía o decía «en revisión» /
 * «aprobada», y la de Cliente «verificación pendiente»: a quien compartía equipo o red le cerraba
 * el paso. Ahora las cuatro tarjetas son siempre las mismas y sin estados de cuenta:
 * · que falta verificar el correo lo dice la ventana de INICIO DE SESIÓN, con «reenviar»;
 * · el candidato aprobado entra por el enlace de su correo de aprobación;
 * · lo único que se consulta es si este equipo creó un registro en las últimas 24 horas
 *   (`/api/registro/estado`): entonces Postulación queda en pausa y Cliente avisa de que crear
 *   cuenta está en pausa (iniciar sesión sigue igual).
 * `AccionesAcceso` conserva los manejadores de estados por si otra pantalla los usa.
 */
export function useOpcionesAcceso(destination: 'game' | 'dashboard', acciones: AccionesAcceso): OpcionAcceso[] {
  const { dest } = nombresDestino(destination);

  const registro = useEstadoRegistro();
  const pausa = !!registro?.bloqueado;
  const sinAccion = () => undefined;

  return [
    pausa
      ? {
          clave: 'candidato',
          grupo: 'nuevo',
          pausada: true,
          tono: 'warning',
          Icono: Clock,
          insignia: 'En pausa',
          titulo: 'Postulación',
          corta: `Disponible desde el ${horaDeReanudacion(registro?.hasta ?? null)}.`,
          descripcion: `Desde este equipo ya se creó un registro en las últimas 24 horas. Podrás postularte a partir del ${horaDeReanudacion(registro?.hasta ?? null)}.`,
          onClick: sinAccion,
        }
      : {
          clave: 'candidato',
          grupo: 'nuevo',
          tono: 'default',
          Icono: UserPlus,
          titulo: 'Postulación',
          corta: 'Conoce el proyecto y postúlate.',
          descripcion: 'Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados.',
          onClick: acciones.onCandidate,
        },
    {
      clave: 'soy-candidato',
      grupo: 'cuenta',
      tono: 'default',
      Icono: LogIn,
      titulo: 'Candidato',
      corta: 'Inicia sesión con tu cuenta.',
      descripcion: `Ya tengo una cuenta de candidato: iniciar sesión y ${dest}.`,
      onClick: acciones.onCandidateLogin,
    },
    {
      clave: 'cliente',
      grupo: 'cuenta',
      tono: pausa ? 'warning' : 'default',
      Icono: Briefcase,
      insignia: pausa ? 'Alta en pausa' : undefined,
      titulo: 'Cliente',
      corta: pausa ? 'Inicia sesión; crear cuenta, en pausa.' : 'Tus productos y servicios.',
      descripcion: pausa
        ? `Puedes iniciar sesión con tu cuenta. Crear una cuenta nueva desde este equipo estará disponible a partir del ${horaDeReanudacion(registro?.hasta ?? null)}.`
        : destination === 'dashboard'
          ? 'Accede a la Plataforma para gestionar tus productos, servicios y proyectos del grupo.'
          : 'Inicia sesión (o crea tu cuenta) y entra al Videojuego.',
      onClick: acciones.onClient,
    },
    {
      clave: 'miembro',
      grupo: 'cuenta',
      tono: 'default',
      Icono: ShieldCheck,
      titulo: 'Miembro',
      corta: 'Miembros y administradores.',
      descripcion: `Ya soy miembro o administrador: iniciar sesión y ${dest}.`,
      onClick: acciones.onMember,
    },
  ];
}
