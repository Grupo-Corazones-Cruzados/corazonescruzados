'use client';

/**
 * ProposalPendingModal
 * --------------------
 * Se muestra a un candidato cuya postulación ya está registrada (reconocido por
 * su IP al volver a "Entrar → candidato", o justo tras enviar su propuesta).
 * Le indica que debe esperar la aprobación del administrador global y verificar
 * el correo enviado.
 */

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function ProposalPendingModal({
  email,
  emailVerified,
  onClose,
}: {
  email?: string | null;
  emailVerified?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
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
          maxWidth: 480,
          background: '#0e1118',
          border: '2px solid var(--color-accent)',
          borderRadius: 6,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.55), 0 0 36px rgba(75,45,142,0.4)',
          position: 'relative',
          padding: '30px 26px 26px',
          textAlign: 'center',
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

        <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
        <h2
          style={{
            fontFamily: PIXEL,
            fontSize: '1rem',
            color: '#f1eefb',
            margin: '0 0 14px',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          Tu postulación está en revisión
        </h2>

        <p style={{ fontFamily: BODY, fontSize: '0.9rem', lineHeight: 1.6, color: '#cfc9e2', margin: '0 0 12px' }}>
          Tu propuesta quedó registrada y está{' '}
          <strong style={{ color: '#fff' }}>en espera de aprobación</strong> por parte del
          administrador del proyecto. Te avisaremos cuando sea aprobada.
        </p>

        <div
          style={{
            fontFamily: BODY,
            fontSize: '0.85rem',
            lineHeight: 1.55,
            color: emailVerified ? '#bfe6c9' : '#f3e2c2',
            background: emailVerified ? 'rgba(40,120,70,0.16)' : 'rgba(160,110,40,0.16)',
            borderLeft: `3px solid ${emailVerified ? '#4fae72' : '#caa14a'}`,
            borderRadius: 4,
            padding: '11px 13px',
            textAlign: 'left',
            margin: '4px 0 18px',
          }}
        >
          {emailVerified ? (
            <>✓ Tu correo {email ? <strong>{email}</strong> : ''} ya está verificado.</>
          ) : (
            <>
              Te enviamos un correo {email ? <strong>a {email}</strong> : ''}:{' '}
              <strong style={{ color: '#fff' }}>verifícalo</strong> para continuar. Revisa tu bandeja
              de entrada (y la carpeta de spam).
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="pixel-btn pixel-btn-primary"
          style={{ width: '100%' }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
