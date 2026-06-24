'use client';

/**
 * ClientLoginModal
 * ----------------
 * Inicio de sesión para un cliente que YA tiene cuenta (reconocido por su IP al
 * elegir "Soy cliente"). Usa el endpoint de login existente
 * (/api/character/auth/login). Tras iniciar sesión, su destino será el
 * marketplace (pendiente de backend).
 */

import { useState } from 'react';
import BrandLoader from '@/components/ui/BrandLoader';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function ClientLoginModal({
  onClose,
  onLoggedIn,
}: {
  onClose: () => void;
  onLoggedIn: () => void;
}) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo iniciar sesión');
        return;
      }
      onLoggedIn();
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

          <h2 style={title}>Inicia sesión</h2>
          <p style={{ fontFamily: BODY, fontSize: '0.84rem', color: '#b9b2cf', margin: '0 0 16px' }}>
            Ya tienes una cuenta de cliente. Ingresa para continuar.
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            {error && (
              <div style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#ff8f8f' }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="pixel-btn pixel-btn-primary"
              style={{ marginTop: 4, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
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
