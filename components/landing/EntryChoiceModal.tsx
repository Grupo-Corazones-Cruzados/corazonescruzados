'use client';

/**
 * EntryChoiceModal
 * ----------------
 * Aparece tras pulsar "Entrar" en la landing (visitante nuevo) y pregunta cómo
 * quiere ingresar:
 *  - Candidato: conoce el proyecto (sliders de onboarding) y se postula.
 *  - Cliente: va directo a la creación de cuenta para adquirir productos/servicios
 *    (sin sliders ni pregunta de motivación). Su cuenta es de tipo 'client'.
 *
 * Sigue el patrón de overlay pixelart de AccountRecoveryModal.
 */

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function EntryChoiceModal({
  onCandidate,
  onClient,
  onClose,
}: {
  onCandidate: () => void;
  onClient: () => void;
  onClose: () => void;
}) {
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
          <Option
            title="Quiero postularme como candidato"
            desc="Conoce el proyecto y postúlate para formar parte del Grupo Corazones Cruzados."
            onClick={onCandidate}
          />
          <Option
            title="Soy cliente"
            desc="Quiero adquirir los productos, servicios y proyectos del grupo."
            onClick={onClient}
          />
        </div>
      </div>
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
