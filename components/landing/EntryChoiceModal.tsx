'use client';

/**
 * EntryChoiceModal
 * ----------------
 * Aparece tras pulsar "Entrar" en la landing (visitante nuevo) y pregunta cómo
 * quiere ingresar. Si por su IP ya hay una postulación de candidato registrada,
 * la opción "Quiero postularme" se reemplaza por una tarjeta de "en proceso de
 * aprobación".
 */

import { useEffect, useState } from 'react';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function EntryChoiceModal({
  onCandidate,
  onCandidateLogin,
  onClient,
  onMember,
  onProposalPending,
  onClientPending,
  onClose,
  destination = 'game',
}: {
  onCandidate: () => void;
  onCandidateLogin: () => void;
  onClient: () => void;
  onMember: () => void;
  onProposalPending: (info: { email?: string | null; emailVerified?: boolean }) => void;
  /** Cliente con cuenta no verificada → mostrar "requiere verificación". */
  onClientPending: (info: { email?: string | null }) => void;
  onClose: () => void;
  /** Destino tras iniciar sesión: "game" (Entrar) o "dashboard" (Colaborar). */
  destination?: 'game' | 'dashboard';
}) {
  const dest = destination === 'dashboard' ? 'entrar al panel' : 'entrar al juego';
  // ¿Este visitante (por IP) ya tiene una postulación registrada?
  const [proposal, setProposal] = useState<{
    exists: boolean;
    email?: string | null;
    emailVerified?: boolean;
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'radial-gradient(circle at 50% 30%, rgba(40,22,80,0.55), rgba(0,0,0,0.82))',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'pixelFadeIn 0.45s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#0e1118',
          border: '2px solid var(--color-accent)',
          borderRadius: 6,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.55), 0 0 36px rgba(75,45,142,0.4)',
          position: 'relative',
          padding: '30px 26px 26px',
        }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            background: 'transparent',
            border: 0,
            color: 'rgba(225,215,255,0.6)',
            fontFamily: PIXEL,
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 6,
          }}
        >
          ✕
        </button>

        <h2
          style={{
            fontFamily: PIXEL,
            fontSize: '1.05rem',
            color: '#f1eefb',
            textAlign: 'center',
            margin: '0 0 6px',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          ¿Cómo quieres ingresar?
        </h2>
        <p
          style={{
            fontFamily: BODY,
            fontSize: '0.85rem',
            color: '#b9b2cf',
            textAlign: 'center',
            margin: '0 0 22px',
          }}
        >
          Elige tu camino para continuar.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {proposal === null ? (
            <LoadingCard />
          ) : proposal.exists ? (
            <Option
              title="Tu postulación está en proceso de aprobación"
              desc="Para avanzar más rápido, verifica tu correo con el enlace enviado a tu bandeja de entrada. Una vez seas aprobado podrás ingresar como candidato."
              onClick={() =>
                onProposalPending({ email: proposal.email, emailVerified: proposal.emailVerified })
              }
            />
          ) : (
            <Option
              title="Quiero postularme como candidato"
              desc="Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados."
              onClick={onCandidate}
            />
          )}
          <Option
            title="Soy candidato"
            desc={`Ya tengo una cuenta de candidato: iniciar sesión y ${dest}.`}
            onClick={onCandidateLogin}
          />
          {client === null ? (
            <LoadingCard label="Verificando tu cuenta de cliente…" />
          ) : client.exists && !client.verified ? (
            <Option
              title="Tu cuenta de cliente requiere verificación"
              desc="Te enviamos un enlace de verificación a tu correo. Verifícalo para poder iniciar sesión. No es necesario crear otra cuenta."
              onClick={() => onClientPending({ email: client.email })}
            />
          ) : (
            <Option
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
            title="Ingresar como miembro"
            desc={`Ya soy miembro o administrador: iniciar sesión y ${dest}.`}
            onClick={onMember}
          />
        </div>
      </div>
    </div>
  );
}

function LoadingCard({ label = 'Verificando tu estado de postulación…' }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      style={{
        width: '100%',
        background: 'rgba(75,45,142,0.12)',
        border: '1px solid rgba(123,95,191,0.3)',
        borderRadius: 6,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'breathe 1.6s ease-in-out infinite',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          flexShrink: 0,
          borderRadius: '50%',
          border: '2px solid rgba(123,95,191,0.4)',
          borderTopColor: 'var(--color-accent-glow, #7B5FBF)',
          animation: 'slowSpin 0.8s linear infinite',
        }}
      />
      <span style={{ fontFamily: BODY, fontSize: '0.85rem', color: 'rgba(225,215,255,0.65)' }}>
        {label}
      </span>
    </div>
  );
}

function Option({
  title,
  desc,
  onClick,
}: {
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        width: '100%',
        cursor: 'pointer',
        background: 'rgba(75,45,142,0.18)',
        border: '1px solid rgba(123,95,191,0.45)',
        borderRadius: 6,
        padding: '16px 18px',
        transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(123,95,191,0.3)';
        e.currentTarget.style.borderColor = 'var(--color-accent-glow, #7B5FBF)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(75,45,142,0.18)';
        e.currentTarget.style.borderColor = 'rgba(123,95,191,0.45)';
      }}
    >
      <div
        style={{
          fontFamily: PIXEL,
          fontSize: '0.82rem',
          color: '#f1eefb',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <span>{title}</span>
        <span style={{ color: 'var(--color-accent-glow, #7B5FBF)' }}>→</span>
      </div>
      <div style={{ fontFamily: BODY, fontSize: '0.85rem', lineHeight: 1.5, color: '#cfc9e2' }}>
        {desc}
      </div>
    </button>
  );
}
