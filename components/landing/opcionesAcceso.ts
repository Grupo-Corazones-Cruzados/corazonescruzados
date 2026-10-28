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
 * estado, la opción ya está con su título y `cargando: true`; al llegar la respuesta cambia
 * su contenido, no su sitio. (Desde el 2026-10-28, si ya te postulaste o ya tienes cuenta de
 * candidato, la tarjeta de postulación se quita: Fernando.)
 */

import { useEffect, useState, type ComponentType } from 'react';
import { BadgeCheck, Briefcase, LogIn, MailWarning, ShieldCheck, UserPlus } from 'lucide-react';

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
  /** Aún se está consultando su estado: se pinta igual, sin poder pulsarse. */
  cargando?: boolean;
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

export function useOpcionesAcceso(destination: 'game' | 'dashboard', acciones: AccionesAcceso): OpcionAcceso[] {
  const { aDestino, dest } = nombresDestino(destination);

  // ¿Este visitante (por IP) ya tiene una postulación registrada?
  const [proposal, setProposal] = useState<{
    exists: boolean;
    status?: string;
    email?: string | null;
    emailVerified?: boolean;
    hasCandidateAccount?: boolean;
  } | null>(null);
  // ¿Este visitante ya tiene una cuenta de cliente (y está verificada)?
  const [client, setClient] = useState<{
    exists: boolean;
    email?: string | null;
    verified?: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/candidate/proposal', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) setProposal(j); })
      .catch(() => { if (alive) setProposal({ exists: false }); });
    fetch('/api/client/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (alive) setClient(j); })
      .catch(() => { if (alive) setClient({ exists: false }); });
    return () => { alive = false; };
  }, []);

  const opciones: OpcionAcceso[] = [];

  const sinAccion = () => undefined;

  if (proposal === null) {
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      cargando: true,
      tono: 'default',
      Icono: UserPlus,
      insignia: 'Comprobando…',
      titulo: 'Postulación',
      corta: 'Conoce el proyecto y postúlate.',
      descripcion: 'Comprobando si ya te postulaste desde este dispositivo…',
      onClick: sinAccion,
    });
  } else if (proposal.exists && proposal.status === 'approved') {
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      tono: 'success',
      Icono: BadgeCheck,
      insignia: 'Aprobada',
      titulo: 'Postulación',
corta: 'Crea tu cuenta y entra.',
      descripcion: 'Fuiste aceptado por el administrador. Continúa para crear tu cuenta (contraseña y datos) e ingresar como candidato.',
      onClick: () => acciones.onProposalApproved({ email: proposal.email }),
    });
  } else if (proposal.exists || proposal.hasCandidateAccount) {
    // Ya se postuló (en revisión) o ya tiene cuenta de candidato: la tarjeta de postulación NO
    // se muestra (Fernando, 2026-10-28); entra por «Candidato». Solo queda la de «Aprobada»
    // (arriba), que lleva a crear la cuenta: sin ella no habría por dónde terminar el alta.
  } else {
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      tono: 'default',
      Icono: UserPlus,
      titulo: 'Postulación',
      corta: 'Conoce el proyecto y postúlate.',
      descripcion: 'Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados.',
      onClick: acciones.onCandidate,
    });
  }

  opciones.push({
    clave: 'soy-candidato',
    grupo: 'cuenta',
    tono: 'default',
    Icono: LogIn,
    titulo: 'Candidato',
        corta: 'Inicia sesión con tu cuenta.',
    descripcion: `Ya tengo una cuenta de candidato: iniciar sesión y ${dest}.`,
    onClick: acciones.onCandidateLogin,
  });

  if (client === null) {
    opciones.push({
      clave: 'cliente',
      grupo: 'cuenta',
      cargando: true,
      tono: 'default',
      Icono: Briefcase,
      insignia: 'Comprobando…',
      titulo: 'Cliente',
      corta: 'Tus productos y servicios.',
      descripcion: 'Comprobando tu cuenta de cliente…',
      onClick: sinAccion,
    });
  } else if (client.exists && !client.verified) {
    opciones.push({
      clave: 'cliente',
      grupo: 'cuenta',
      tono: 'warning',
      Icono: MailWarning,
      insignia: 'Verificación pendiente',
      titulo: 'Cliente',
            corta: 'Verifica tu correo para entrar.',
      descripcion: 'Te enviamos un enlace de verificación a tu correo. Verifícalo para poder iniciar sesión. No es necesario crear otra cuenta.',
      onClick: () => acciones.onClientPending({ email: client.email }),
    });
  } else {
    opciones.push({
      clave: 'cliente',
      grupo: 'cuenta',
      tono: 'default',
      Icono: Briefcase,
      titulo: 'Cliente',
      corta: 'Tus productos y servicios.',
      descripcion:
        destination === 'dashboard'
          ? `Accede ${aDestino} para gestionar tus productos, servicios y proyectos del grupo.`
          : `Inicia sesión (o crea tu cuenta) y entra ${aDestino}.`,
      onClick: acciones.onClient,
    });
  }

  opciones.push({
    clave: 'miembro',
    grupo: 'cuenta',
    tono: 'default',
    Icono: ShieldCheck,
    titulo: 'Miembro',
        corta: 'Miembros y administradores.',
    descripcion: `Ya soy miembro o administrador: iniciar sesión y ${dest}.`,
    onClick: acciones.onMember,
  });

  return opciones;
}
