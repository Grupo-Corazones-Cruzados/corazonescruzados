'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import BrandLoader from '@/components/ui/BrandLoader';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function AccountRecoveryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'creds' | 'code'>('creds');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState<string | null>(null);

  const submitCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/character/auth/recover/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
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

  // Passkey: si hay una registrada en este dispositivo, entra DIRECTO (sin código).
  const loginWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const begin = await fetch('/api/character/auth/passkey/login/begin', { method: 'POST' });
      const opts = await begin.json();
      if (!begin.ok) {
        setError(opts?.error ?? 'No hay passkey en este dispositivo');
        return;
      }
      const credential = await startAuthentication({ optionsJSON: opts });
      const finish = await fetch('/api/character/auth/passkey/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      const fj = await finish.json();
      if (!finish.ok) {
        setError(fj?.error ?? 'Passkey rechazada');
        return;
      }
      onSuccess();
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
      const r = await fetch('/api/character/auth/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Código incorrecto');
        return;
      }
      onSuccess();
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
            style={{ fontFamily: PIXEL, fontSize: '0.72rem', letterSpacing: '0.2em', color: '#fff' }}
          >
            GCC WORLD
          </span>
        </div>

        <div style={panel}>
          <button type="button" aria-label="Cerrar" onClick={onClose} style={closeBtn}>
            ✕
          </button>

          <h2 style={title}>{step === 'creds' ? 'Ya tengo una cuenta' : 'Confirma el código'}</h2>
          <p style={{ fontFamily: BODY, fontSize: '0.84rem', color: '#b9b2cf', margin: '0 0 16px' }}>
            {step === 'creds'
              ? 'Inicia sesión y vincula este dispositivo.'
              : `Te enviamos un código a ${masked ?? 'tu correo'}.`}
          </p>

          {step === 'creds' ? (
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
                {busy ? 'Enviando código...' : 'Enviar código'}
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '4px 0',
                  color: 'rgba(225,215,255,0.4)',
                  fontFamily: BODY,
                  fontSize: '0.72rem',
                }}
              >
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />o
                <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              </div>

              <button
                type="button"
                onClick={loginWithPasskey}
                disabled={busy}
                className="pixel-btn pixel-btn-secondary"
                style={{ opacity: busy ? 0.6 : 1 }}
              >
                🔑 Ingresar con passkey
              </button>
            </form>
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
                style={{
                  ...input,
                  textAlign: 'center',
                  letterSpacing: '0.45em',
                  fontSize: '1.1rem',
                }}
              />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="pixel-btn pixel-btn-primary"
                style={{ marginTop: 4, opacity: busy || code.length !== 6 ? 0.5 : 1 }}
              >
                {busy ? 'Verificando...' : 'Confirmar y entrar'}
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
  return (
    <div style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#ff8f8f' }}>{children}</div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 300,
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

const input: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  background: '#0d1119',
  color: '#e9e6f5',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6,
  fontFamily: BODY,
  fontSize: '0.9rem',
  outline: 'none',
};
