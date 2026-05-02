'use client';

import { useState } from 'react';

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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'pixelFadeIn 0.45s ease-out',
        fontFamily: "'Silkscreen', cursive",
        color: '#e5e5e5',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#131923',
          border: '2px solid var(--color-accent)',
          padding: '28px 26px',
          boxShadow: '6px 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(75,45,142,0.35)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'transparent',
            border: 0,
            color: 'rgba(225,215,255,0.6)',
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.85rem',
            cursor: 'pointer',
            padding: 6,
          }}
        >
          ✕
        </button>

        <div
          style={{
            fontSize: '0.8rem',
            letterSpacing: '0.22em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: 6,
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          {step === 'creds' ? 'Ya tengo una cuenta' : 'Confirma el código'}
        </div>
        <div
          style={{
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            color: 'rgba(225,215,255,0.7)',
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          {step === 'creds'
            ? 'Inicia sesión y vincula este dispositivo'
            : `Te enviamos un código a ${masked ?? 'tu correo'}`}
        </div>

        {step === 'creds' ? (
          <form
            onSubmit={submitCreds}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              autoComplete="email"
              autoFocus
              style={inputStyle()}
            />
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              style={inputStyle()}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <button
              type="submit"
              disabled={busy}
              className="pixel-btn pixel-btn-primary"
              style={{ marginTop: 6, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Enviando código...' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={submitCode}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))
              }
              placeholder="Código de 6 dígitos"
              autoFocus
              style={{
                ...inputStyle(),
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
              style={{
                marginTop: 6,
                opacity: busy || code.length !== 6 ? 0.5 : 1,
              }}
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
              className="pixel-btn pixel-btn-secondary"
              style={{ marginTop: 4 }}
            >
              ← Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: '#0f1320',
    color: '#e5e5e5',
    border: '2px solid var(--color-accent)',
    fontFamily: "'Silkscreen', cursive",
    fontSize: '0.78rem',
    letterSpacing: '0.05em',
    outline: 'none',
  };
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.62rem',
        letterSpacing: '0.05em',
        color: '#ff6f6f',
      }}
    >
      {children}
    </div>
  );
}
