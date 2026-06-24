'use client';

/**
 * ClientSignupModal
 * -----------------
 * Creación de cuenta de CLIENTE directamente desde la landing (sin pasar por el
 * juego). Recoge los datos de cuenta + contraseña y los envía a
 * POST /api/client/signup; luego pide verificar el correo. Su inicio (tras
 * verificar) será el marketplace (pendiente de backend).
 */

import { useState } from 'react';
import BrandLoader from '@/components/ui/BrandLoader';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function ClientSignupModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ok =
    fullName.trim().length > 1 &&
    emailOk &&
    country.trim().length > 1 &&
    address.trim().length > 2 &&
    phone.trim().length >= 7 &&
    pwd.length >= 8 &&
    pwd === pwd2 &&
    terms;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (pwd !== pwd2) return setError('Las contraseñas no coinciden');
    setBusy(true);
    try {
      // Cuenta de cliente = usuario con rol 'client' en gcc_world.users
      // (auth nativa del dashboard). Verifica correo antes de iniciar sesión.
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pwd,
          first_name: fullName.trim(),
          last_name: '',
          phone: phone.trim(),
          country: country.trim(),
          address: address.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo crear la cuenta');
        return;
      }
      setSent(true);
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" style={overlay}>
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <BrandLoader size="md" />
          <span
            style={{
              fontFamily: PIXEL,
              fontSize: '0.72rem',
              letterSpacing: '0.2em',
              color: '#fff',
            }}
          >
            GCC WORLD
          </span>
        </div>

        <div style={panel}>
          <button type="button" aria-label="Cerrar" onClick={onClose} style={closeBtn}>
            ✕
          </button>

          {sent ? (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>📬</div>
            <h2 style={title}>Confirma tu correo</h2>
            <p style={{ fontFamily: BODY, fontSize: '0.9rem', lineHeight: 1.6, color: '#cfc9e2' }}>
              Te enviamos un enlace a <strong style={{ color: '#fff' }}>{email}</strong>. Ábrelo
              para activar tu cuenta de cliente y poder adquirir nuestros productos y servicios.
            </p>
            <button
              type="button"
              className="pixel-btn pixel-btn-primary"
              style={{ width: '100%', marginTop: 18 }}
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            <h2 style={title}>Crea tu cuenta de cliente</h2>
            <p
              style={{
                fontFamily: BODY,
                fontSize: '0.84rem',
                color: '#b9b2cf',
                margin: '0 0 16px',
              }}
            >
              Para adquirir los productos, servicios y proyectos del grupo.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={grid}>
                <Field label="Nombre completo" value={fullName} onChange={setFullName} autoFocus />
                <Field
                  label="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  invalid={email.length > 0 && !emailOk}
                />
                <Field label="País" value={country} onChange={setCountry} />
                <Field label="Contacto telefónico" type="tel" value={phone} onChange={setPhone} />
              </div>
              <Field label="Dirección" value={address} onChange={setAddress} />
              <div style={grid}>
                <Field
                  label="Contraseña (mín. 8)"
                  type="password"
                  value={pwd}
                  onChange={setPwd}
                />
                <Field
                  label="Confirma la contraseña"
                  type="password"
                  value={pwd2}
                  onChange={setPwd2}
                  invalid={pwd2.length > 0 && pwd !== pwd2}
                />
              </div>

              <Check checked={terms} onToggle={() => setTerms((v) => !v)}>
                Acepto los{' '}
                <a
                  href="/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: '#c9b6ff', textDecoration: 'underline' }}
                >
                  términos y condiciones y la política de privacidad
                </a>
                , y autorizo el tratamiento de mis datos conforme a ella.
              </Check>
              <Check checked={marketing} onToggle={() => setMarketing((v) => !v)}>
                Quiero recibir información sobre publicidad, productos y novedades del proyecto
                (opcional).
              </Check>

              {error && (
                <div style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#ff8f8f' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!ok || busy}
                className="pixel-btn pixel-btn-primary"
                style={{ marginTop: 4, opacity: !ok || busy ? 0.5 : 1, cursor: ok && !busy ? 'pointer' : 'default' }}
              >
                {busy ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>

              <button
                type="button"
                onClick={onLogin}
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: BODY,
                  fontSize: '0.78rem',
                  color: '#c9b6ff',
                  textDecoration: 'underline',
                  marginTop: 2,
                }}
              >
                ¿Ya tienes cuenta? Inicia sesión
              </button>
            </form>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoFocus = false,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        autoComplete={
          type === 'password' ? 'new-password' : type === 'email' ? 'email' : undefined
        }
        style={{
          width: '100%',
          padding: '10px 12px',
          background: '#0d1119',
          color: '#e9e6f5',
          border: `1px solid ${invalid ? '#c8455c' : 'rgba(255,255,255,0.14)'}`,
          borderRadius: 6,
          fontFamily: BODY,
          fontSize: '0.88rem',
          outline: 'none',
        }}
      />
    </div>
  );
}

function Check({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '2px 0' }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          marginTop: 1,
          width: 19,
          height: 19,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          color: '#fff',
          background: checked ? 'var(--color-accent, #4B2D8E)' : 'transparent',
          border: checked
            ? '2px solid var(--color-accent-glow, #7B5FBF)'
            : '2px solid rgba(123,95,191,0.6)',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ fontFamily: BODY, fontSize: '0.76rem', lineHeight: 1.45, color: 'rgba(225,215,255,0.82)' }}>
        {children}
      </span>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 230,
  background: 'rgba(6,7,12,0.82)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  animation: 'pixelFadeIn 0.45s ease-out',
};

const panel: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxHeight: '78vh',
  overflowY: 'auto',
  background: '#121722',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  padding: '26px 24px',
};

const closeBtn: React.CSSProperties = {
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
};

const title: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: '1rem',
  color: '#f1eefb',
  margin: '0 0 6px',
  textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
};

const labelStyle: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: '0.6rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--color-accent-glow, #7B5FBF)',
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
};
