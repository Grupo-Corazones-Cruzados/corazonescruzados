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
 * su contenido, no su sitio. Antes una tarjeta «Verificando…» aparecía y se iba, y si ya
 * tenías cuenta de candidato la de postularse desaparecía: confundía. Ahora, en ese caso,
 * dice «Ya tienes cuenta de candidato» y lleva a iniciar sesión.
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
      titulo: 'Quiero postularme como candidato',
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
      titulo: '¡Tu postulación fue aprobada!',
      descripcion: 'Fuiste aceptado por el administrador. Continúa para crear tu cuenta (contraseña y datos) e ingresar como candidato.',
      onClick: () => acciones.onProposalApproved({ email: proposal.email }),
    });
  } else if (proposal.exists) {
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      tono: 'warning',
      Icono: MailWarning,
      insignia: 'En revisión',
      titulo: 'Tu postulación está en proceso de aprobación',
      descripcion: 'Para avanzar más rápido, verifica tu correo con el enlace enviado a tu bandeja de entrada. Una vez seas aprobado podrás ingresar como candidato.',
      onClick: () => acciones.onProposalPending({ email: proposal.email, emailVerified: proposal.emailVerified }),
    });
  } else if (proposal.hasCandidateAccount) {
    // Ya es candidato con cuenta: no se ofrece «postularme», pero la tarjeta se queda y lleva
    // a iniciar sesión (antes desaparecía).
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      tono: 'success',
      Icono: BadgeCheck,
      insignia: 'Cuenta activa',
      titulo: 'Ya tienes cuenta de candidato',
      descripcion: 'Te postulaste y tu cuenta ya está creada. Inicia sesión como candidato para continuar.',
      onClick: acciones.onCandidateLogin,
    });
  } else {
    opciones.push({
      clave: 'candidato',
      grupo: 'nuevo',
      tono: 'default',
      Icono: UserPlus,
      titulo: 'Quiero postularme como candidato',
      descripcion: 'Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados.',
      onClick: acciones.onCandidate,
    });
  }

  opciones.push({
    clave: 'soy-candidato',
    grupo: 'cuenta',
    tono: 'default',
    Icono: LogIn,
    titulo: 'Soy candidato',
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
      titulo: 'Soy cliente',
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
      titulo: 'Tu cuenta de cliente requiere verificación',
      descripcion: 'Te enviamos un enlace de verificación a tu correo. Verifícalo para poder iniciar sesión. No es necesario crear otra cuenta.',
      onClick: () => acciones.onClientPending({ email: client.email }),
    });
  } else {
    opciones.push({
      clave: 'cliente',
      grupo: 'cuenta',
      tono: 'default',
      Icono: Briefcase,
      titulo: 'Soy cliente',
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
    titulo: 'Ingresar como miembro',
    descripcion: `Ya soy miembro o administrador: iniciar sesión y ${dest}.`,
    onClick: acciones.onMember,
  });

  return opciones;
}
