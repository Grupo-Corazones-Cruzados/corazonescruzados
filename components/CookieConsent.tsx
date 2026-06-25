'use client';

/**
 * CookieConsent — banner de consentimiento de cookies (en todo el sitio).
 * Informa que el sitio usa cookies (sesión, seguridad, reconocimiento de
 * dispositivo) y guarda la decisión del usuario en localStorage. Enlaza a /legal.
 */

import { useEffect, useState } from 'react';

const KEY = 'gcc_cookie_consent';
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  const decide = (value: 'accepted' | 'rejected') => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 400,
        maxWidth: 760,
        margin: '0 auto',
        background: '#121722',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
        padding: '16px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 14,
        animation: 'pixelFadeIn 0.4s ease-out',
      }}
    >
      <p
        style={{
          flex: '1 1 320px',
          margin: 0,
          fontFamily: BODY,
          fontSize: '0.84rem',
          lineHeight: 1.55,
          color: '#cfc9e2',
        }}
      >
        Usamos cookies para el funcionamiento del sitio, tu sesión y la seguridad (por ejemplo, para
        reconocer tu dispositivo y tu estado de postulación). Consulta nuestra{' '}
        <a
          href="/legal"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#c9b6ff', textDecoration: 'underline' }}
        >
          Política de Privacidad
        </a>
        .
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => decide('rejected')}
          style={{
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: '0.82rem',
            color: '#cfc9e2',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: '9px 16px',
          }}
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => decide('accepted')}
          style={{
            cursor: 'pointer',
            fontFamily: BODY,
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#fff',
            background:
              'linear-gradient(135deg, var(--color-accent-glow, #7B5FBF), var(--color-accent, #4B2D8E))',
            border: '1px solid var(--color-accent-glow, #7B5FBF)',
            borderRadius: 8,
            padding: '9px 18px',
            boxShadow: '0 3px 12px rgba(123,95,191,0.4)',
          }}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
