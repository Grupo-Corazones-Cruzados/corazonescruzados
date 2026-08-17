'use client';

/**
 * EntryChoiceModal
 * ----------------
 * Aparece tras pulsar "Entrar" en la landing (visitante nuevo) y pregunta cómo
 * quiere ingresar. Si por su IP ya hay una postulación de candidato registrada,
 * la opción "Quiero postularme" se reemplaza por una tarjeta de "en proceso de
 * aprobación".
 *
 * DISEÑO (2026-07-25): usa el **diseño del dashboard** (Fluent) en vez del pixelart
 * de la landing, en su variante **MODO OSCURO** (pedido del usuario) para no romper
 * con la landing oscura. El overlay lleva `corp dark corp-overlay`: isla de tokens
 * Fluent oscuros (`.corp.dark`) sin fondo de página (ver `.corp.corp-overlay` en
 * globals.css). Los controles se componen con los tokens `digi-*`/`accent`, iconos
 * `lucide-react` y los componentes compartidos (`Button`, `PixelBadge`). NO hay hex
 * crudos aquí: cambiar los tokens de `.corp`/`.corp.dark` recolorea este modal.
 * Para pasarlo a claro basta quitar la clase `dark` del overlay.
 */

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  ChevronRight,
  Loader2,
  LogIn,
  MailWarning,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import PixelBadge from '@/components/ui/PixelBadge';

type Tone = 'default' | 'success' | 'warning';

export default function EntryChoiceModal({
  onCandidate,
  onCandidateLogin,
  onClient,
  onMember,
  onProposalPending,
  onProposalApproved,
  onClientPending,
  onClose,
  destination = 'game',
}: {
  onCandidate: () => void;
  onCandidateLogin: () => void;
  onClient: () => void;
  onMember: () => void;
  onProposalPending: (info: { email?: string | null; emailVerified?: boolean }) => void;
  /** La postulación ya fue APROBADA por el admin → continuar a crear cuenta. */
  onProposalApproved: (info: { email?: string | null }) => void;
  /** Cliente con cuenta no verificada → mostrar "requiere verificación". */
  onClientPending: (info: { email?: string | null }) => void;
  onClose: () => void;
  /** Destino tras iniciar sesión: "game" (Entrar) o "dashboard" (Colaborar). */
  destination?: 'game' | 'dashboard';
}) {
  const dest = destination === 'dashboard' ? 'entrar al panel' : 'entrar al juego';

  /**
   * EL TITULAR DICE A DÓNDE SE ENTRA (Fernando, 2026-08-17).
   *
   * Era «¿Cómo quieres ingresar?» a secas, y el mismo diálogo sirve para dos destinos muy
   * distintos: la plataforma de trabajo y el videojuego. Quien lo abría desde «Plataforma»
   * y quien lo abría desde «Comenzar Aventura» veían exactamente lo mismo.
   *
   * La preposición cambia con la palabra —«a la Plataforma» pero «al Videojuego»—, así que
   * van juntas en la misma tabla: separarlas obligaría a recordar la concordancia en el
   * sitio donde se pinta.
   */
  const ambito =
    destination === 'dashboard'
      ? { preposicion: 'a la', palabra: 'Plataforma' }
      : { preposicion: 'al', palabra: 'Videojuego' };

  const titulo = `¿Cómo quieres ingresar ${ambito.preposicion} ${ambito.palabra}?`;
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
      .then((j) => {
        if (alive) setProposal(j);
      })
      .catch(() => {
        if (alive) setProposal({ exists: false });
      });
    fetch('/api/client/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (alive) setClient(j);
      })
      .catch(() => {
        if (alive) setClient({ exists: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  // Cerrar con Escape (mismo comportamiento que los diálogos del dashboard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      // El mismo texto que se ve, para que quien navega con lector de pantalla oiga a dónde
      // va a entrar y no solo «cómo quieres ingresar».
      aria-label={titulo}
      className="corp dark corp-overlay fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{
        background: 'rgba(6,7,12,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'pixelFadeIn 0.35s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] my-auto bg-digi-card border border-digi-border rounded-lg overflow-hidden"
        style={{
          boxShadow:
            '0 6.4px 14.4px rgba(0,0,0,0.32), 0 1.2px 3.6px rgba(0,0,0,0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fluent: icono + título + subtítulo, cerrar 32×32 a la derecha */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-digi-border">
          <span className="w-9 h-9 shrink-0 rounded-md bg-accent-light text-accent flex items-center justify-center">
            <LogIn className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            {/* La palabra del destino va resaltada, que es lo que pidió Fernando. El color
                sale de `accent-glow`, **no de un hex**: es el token que `.corp.dark` define
                justo para esto —«brighter accent text on dark», `#a78bfa`— y que en claro
                vale `#4B2D8E`. Así el resalte sigue leyéndose el día que este diálogo pase a
                tema claro, que es tan fácil como quitarle la clase `dark` al overlay. */}
            <h2 className="text-[17px] font-semibold text-digi-text leading-tight">
              ¿Cómo quieres ingresar {ambito.preposicion}{' '}
              <span className="text-accent-glow">{ambito.palabra}</span>?
            </h2>
            <p className="text-[12.5px] text-digi-muted mt-0.5">Elige tu camino para continuar.</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-digi-muted hover:bg-[#f3f2f1] hover:text-digi-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Opciones */}
        {/* Fondo de "página" para que las tarjetas de opción se separen del diálogo */}
        <div className="px-5 py-4 flex flex-col gap-2.5 bg-digi-dark">
          {proposal === null ? (
            <LoadingCard />
          ) : proposal.exists && proposal.status === 'approved' ? (
            <Option
              tone="success"
              Icon={BadgeCheck}
              badge="Aprobada"
              title="¡Tu postulación fue aprobada!"
              desc="Fuiste aceptado por el administrador. Continúa para crear tu cuenta (contraseña y datos) e ingresar como candidato."
              onClick={() => onProposalApproved({ email: proposal.email })}
            />
          ) : proposal.exists ? (
            <Option
              tone="warning"
              Icon={MailWarning}
              badge="En revisión"
              title="Tu postulación está en proceso de aprobación"
              desc="Para avanzar más rápido, verifica tu correo con el enlace enviado a tu bandeja de entrada. Una vez seas aprobado podrás ingresar como candidato."
              onClick={() =>
                onProposalPending({ email: proposal.email, emailVerified: proposal.emailVerified })
              }
            />
          ) : proposal.hasCandidateAccount ? (
            // Ya es candidato con cuenta: no se ofrece "postularme"; usa "Soy candidato".
            null
          ) : (
            <Option
              Icon={UserPlus}
              title="Quiero postularme como candidato"
              desc="Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados."
              onClick={onCandidate}
            />
          )}

          <Option
            Icon={LogIn}
            title="Soy candidato"
            desc={`Ya tengo una cuenta de candidato: iniciar sesión y ${dest}.`}
            onClick={onCandidateLogin}
          />

          {client === null ? (
            <LoadingCard label="Verificando tu cuenta de cliente…" />
          ) : client.exists && !client.verified ? (
            <Option
              tone="warning"
              Icon={MailWarning}
              badge="Verificación pendiente"
              title="Tu cuenta de cliente requiere verificación"
              desc="Te enviamos un enlace de verificación a tu correo. Verifícalo para poder iniciar sesión. No es necesario crear otra cuenta."
              onClick={() => onClientPending({ email: client.email })}
            />
          ) : (
            <Option
              Icon={Briefcase}
              title="Soy cliente"
              desc={
                destination === 'dashboard'
                  ? 'Accede al panel para gestionar tus productos, servicios y proyectos del grupo.'
                  : 'Inicia sesión (o crea tu cuenta) y entra al juego.'
              }
              onClick={onClient}
            />
          )}

          <Option
            Icon={ShieldCheck}
            title="Ingresar como miembro"
            desc={`Ya soy miembro o administrador: iniciar sesión y ${dest}.`}
            onClick={onMember}
          />
        </div>

        {/* Footer del diálogo (acción secundaria a la derecha, como en el dashboard) */}
        <div className="flex justify-end px-5 py-3 border-t border-digi-border">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingCard({ label = 'Verificando tu estado de postulación…' }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      className="flex items-center gap-3 rounded-md border border-digi-border bg-digi-card px-4 py-4"
    >
      <Loader2 className="w-4 h-4 shrink-0 text-accent animate-spin" />
      <span className="text-[12.5px] text-digi-muted">{label}</span>
    </div>
  );
}

/** Fila de opción del diálogo: icono + título + descripción + chevron. */
function Option({
  title,
  desc,
  onClick,
  Icon,
  tone = 'default',
  badge,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  /** 'success' = postulación aprobada · 'warning' = a la espera de una acción. */
  tone?: Tone;
  badge?: string;
}) {
  const card: Record<Tone, string> = {
    default: 'bg-digi-card border-digi-border hover:border-accent hover:bg-accent-light',
    success: 'bg-green-50 border-green-300 hover:bg-green-100',
    warning: 'bg-amber-50 border-amber-300 hover:bg-amber-100',
  };
  const chip: Record<Tone, string> = {
    default: 'bg-accent-light text-accent',
    success: 'bg-white text-green-600',
    warning: 'bg-white text-amber-600',
  };
  const arrow: Record<Tone, string> = {
    default: 'text-digi-muted group-hover:text-accent',
    success: 'text-green-600',
    warning: 'text-amber-600',
  };
  const badgeVariant = tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left flex items-start gap-3 rounded-md border p-3.5 transition-colors ${card[tone]}`}
    >
      <span
        className={`w-9 h-9 shrink-0 rounded-md flex items-center justify-center ${chip[tone]}`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-digi-text">{title}</span>
          {badge && <PixelBadge variant={badgeVariant}>{badge}</PixelBadge>}
        </span>
        <span className="block text-[12.5px] leading-relaxed text-digi-muted mt-1">{desc}</span>
      </span>
      <ChevronRight className={`w-4 h-4 shrink-0 mt-2 transition-colors ${arrow[tone]}`} />
    </button>
  );
}
