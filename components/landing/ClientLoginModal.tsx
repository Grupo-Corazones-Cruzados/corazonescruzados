'use client';

/**
 * ClientLoginModal — login de CLIENTE (gcc_world.users rol 'client') en 2 pasos:
 * credenciales → código de verificación por correo (2FA). Tras iniciar sesión,
 * su destino es el marketplace.
 */

import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import BrandLoader from '@/components/ui/BrandLoader';
import FingerprintIcon from '@/components/landing/FingerprintIcon';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function ClientLoginModal({
  onClose,
  onLoggedIn,
  onSignup,
}: {
  onClose: () => void;
  onLoggedIn: () => void;
  /** Abre el formulario de creación de cuenta de cliente. */
  onSignup: () => void;
}) {
  const [step, setStep] = useState<'creds' | 'factor' | 'code' | 'passkeyOffer'>('creds');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 1: valida credenciales (sin enviar código) → muestra opciones.
  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pwd,
          expect: 'client',
          validateOnly: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Credenciales incorrectas');
        return;
      }
      setMasked(j?.masked ?? null);
      setStep('factor');
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  // Paso 2 (opción A): envía el código de verificación.
  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd, expect: 'client' }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo enviar el código');
        return;
      }
      setMasked(j?.masked ?? null);
      setStep('code');
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  // Passkey de usuario: si hay una en este dispositivo, entra DIRECTO (sin código).
  const loginWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const begin = await fetch('/api/auth/passkey/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const opts = await begin.json();
      if (!begin.ok) {
        setError(
          'Aún no tienes una passkey. Inicia sesión con tu código (botón de arriba) para poder configurarla.',
        );
        return;
      }
      const credential = await startAuthentication({ optionsJSON: opts });
      const finish = await fetch('/api/auth/passkey/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, email: email.trim() }),
      });
      const fj = await finish.json();
      if (!finish.ok) {
        setError(fj?.error ?? 'Passkey rechazada');
        return;
      }
      onLoggedIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de passkey';
      if (!/cancel|abort|timeout|allowed/i.test(msg)) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Código incorrecto');
        return;
      }
      // Si NO tiene passkey, ofrece configurarla; si ya tiene, entra directo.
      if (j.hasPasskey) {
        onLoggedIn();
      } else {
        setError(null);
        setStep('passkeyOffer');
      }
    } catch {
      setError('Error de red');
    } finally {
      setBusy(false);
    }
  };

  // Registro de passkey de usuario (la sesión ya quedó activa tras el código).
  const registerPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const begin = await fetch('/api/auth/passkey/register/begin', { method: 'POST' });
      const opts = await begin.json();
      if (!begin.ok) {
        setError(opts?.error ?? 'No se pudo iniciar el registro');
        return;
      }
      const attestation = await startRegistration({ optionsJSON: opts });
      const finish = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      const fj = await finish.json();
      if (!finish.ok) {
        setError(fj?.error ?? 'No se pudo registrar la passkey');
        return;
      }
      onLoggedIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de passkey';
      if (/cancel|abort|timeout|allowed/i.test(msg)) {
        onLoggedIn();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="corp dark corp-overlay" style={overlay}>
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <BrandLoader size="md" />
          <span
            style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', letterSpacing: '0.2em', color: '#fff' }}
          >
            GCC WORLD
          </span>
        </div>

        <div style={panel}>
          <button type="button" aria-label="Cerrar" onClick={onClose} style={closeBtn}>
            ✕
          </button>

          <h2 style={title}>
            {step === 'creds'
              ? 'Inicia sesión'
              : step === 'factor'
                ? 'Elige cómo continuar'
                : step === 'code'
                  ? 'Confirma el código'
                  : 'Configura tu passkey'}
          </h2>
          <p style={{ fontFamily: BODY, fontSize: '0.84rem', color: '#b9b2cf', margin: '0 0 16px' }}>
            {step === 'creds'
              ? 'Ya tienes una cuenta de cliente. Ingresa para continuar.'
              : step === 'factor'
                ? 'Verificamos tus credenciales. Por seguridad, completa un segundo paso.'
                : step === 'code'
                  ? `Te enviamos un código a ${masked ?? 'tu correo'}.`
                  : 'Crea una passkey (huella, Face ID o PIN) para entrar más rápido y seguro la próxima vez, sin código.'}
          </p>

          {step === 'passkeyOffer' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="button"
                onClick={registerPasskey}
                disabled={busy}
                className="pixel-btn pixel-btn-primary"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <FingerprintIcon />
                  Configurar passkey
                </span>
              </button>
              <button
                type="button"
                onClick={onLoggedIn}
                disabled={busy}
                className="pixel-btn pixel-btn-secondary"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                Ahora no, continuar
              </button>
            </div>
          ) : step === 'creds' ? (
            <form onSubmit={submitCreds} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                autoComplete="email"
                autoFocus
                style={input}
              />
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="Contraseña"
                autoComplete="current-password"
                style={input}
              />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={busy}
                className="pixel-btn pixel-btn-primary"
                style={{ marginTop: 4, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Verificando...' : 'Continuar'}
              </button>

              <button
                type="button"
                onClick={onSignup}
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
                ¿No tienes cuenta? Crear cuenta de cliente
              </button>
            </form>
          ) : step === 'factor' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="button"
                onClick={sendCode}
                disabled={busy}
                className="pixel-btn pixel-btn-primary"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Enviando código...' : 'Enviar código'}
              </button>
              <button
                type="button"
                onClick={loginWithPasskey}
                disabled={busy}
                className="pixel-btn pixel-btn-secondary"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <FingerprintIcon />
                  Ingresar con passkey
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('creds');
                  setError(null);
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: BODY,
                  fontSize: '0.78rem',
                  color: '#b9b2cf',
                  textDecoration: 'underline',
                  marginTop: 2,
                }}
              >
                ← Volver
              </button>
            </div>
          ) : (
            <form onSubmit={submitCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="Código de 6 dígitos"
                autoFocus
                style={{ ...input, textAlign: 'center', letterSpacing: '0.45em', fontSize: '1.1rem' }}
              />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="pixel-btn pixel-btn-primary"
                style={{ marginTop: 4, opacity: busy || code.length !== 6 ? 0.5 : 1 }}
              >
                {busy ? 'Verificando...' : 'Iniciar sesión'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('creds');
                  setError(null);
                  setCode('');
                }}
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
                ← Volver
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#ff8f8f' }}>{children}</div>;
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 230,
  background: 'rgba(6,7,12,0.72)',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, overflowY: 'auto',
};

const panel: React.CSSProperties = {
  position: 'relative', width: '100%',
  background: 'var(--color-digi-card)',
  border: '1px solid var(--color-digi-border)',
  borderRadius: 8,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  padding: '22px 20px',
  fontFamily: 'var(--font-body)',
};

const closeBtn: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 12,
  background: 'transparent',
  border: 0,
  color: 'rgba(225,215,255,0.6)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  cursor: 'pointer',
  padding: 6,
};

const title: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '1.06rem', fontWeight: 600,
  color: 'var(--color-digi-text)',
  margin: '0 0 6px', letterSpacing: '-0.01em',
};

const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  background: 'var(--color-digi-darker)',
  color: 'var(--color-digi-text)',
  border: '1px solid var(--color-digi-border)',
  borderRadius: 4,
  fontFamily: 'var(--font-body)', fontSize: '0.85rem',
  outline: 'none',
};
