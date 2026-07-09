'use client';

/**
 * CandidateAccountModal
 * ---------------------
 * Formulario de CREACIÓN DE CUENTA para un candidato ya APROBADO (y con correo
 * verificado). Establece su contraseña definitiva + datos (nombre, país, dirección,
 * teléfono) reemplazando la contraseña temporal. Reusa el endpoint existente
 * `/api/character/auth/complete-profile` (el mismo que usa el SignupForm del juego
 * cuando el correo ya está verificado). Al terminar deja la sesión activa y recarga
 * la landing para continuar el flujo del candidato.
 */

import { useState } from 'react';

const PIXEL = "'Silkscreen', cursive";
const BODY = "'Inter', system-ui, -apple-system, sans-serif";

function inputStyle(readOnly = false): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: '#0f1320',
    color: '#e5e5e5',
    border: '2px solid var(--color-accent)',
    fontFamily: PIXEL,
    fontSize: '0.78rem',
    letterSpacing: '0.05em',
    outline: 'none',
    ...(readOnly ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
  };
}

export default function CandidateAccountModal({
  email,
  onClose,
  onDone,
}: {
  email?: string | null;
  onClose: () => void;
  /** Cuenta creada con éxito (sesión activa). */
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError('Ingresa tu nombre completo');
    if (country.trim().length < 2) return setError('Ingresa tu país');
    if (address.trim().length < 3) return setError('Ingresa tu dirección');
    if (phone.trim().length < 7) return setError('Ingresa un teléfono válido');
    if (pwd.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (pwd !== pwd2) return setError('Las contraseñas no coinciden');
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: pwd,
          fullName: fullName.trim(),
          country: country.trim(),
          address: address.trim(),
          phone: phone.trim(),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo crear la cuenta');
        return;
      }
      onDone();
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
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
          maxWidth: 440,
          background: '#0e1118',
          border: '2px solid var(--color-accent)',
          borderRadius: 6,
          boxShadow: '6px 6px 0 rgba(0,0,0,0.55), 0 0 36px rgba(75,45,142,0.4)',
          position: 'relative',
          padding: '28px 26px 24px',
        }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          style={{ position: 'absolute', top: 10, right: 12, background: 'transparent', border: 0, color: 'rgba(225,215,255,0.6)', fontFamily: PIXEL, fontSize: '0.85rem', cursor: 'pointer', padding: 6 }}
        >
          ✕
        </button>

        <h2 style={{ fontFamily: PIXEL, fontSize: '0.95rem', color: '#f1eefb', textAlign: 'center', margin: '0 0 6px', textShadow: '1px 1px 0 rgba(0,0,0,0.6)' }}>
          Crea tu cuenta
        </h2>
        <p style={{ fontFamily: BODY, fontSize: '0.82rem', color: '#b9b2cf', textAlign: 'center', margin: '0 0 18px', lineHeight: 1.5 }}>
          Establece tu contraseña y tus datos para completar tu ingreso como candidato.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" autoComplete="name" autoFocus style={inputStyle()} />
          <input type="email" value={email ?? ''} readOnly title="Tu correo ya fue verificado y no se puede cambiar" style={inputStyle(true)} />
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="País" autoComplete="country-name" style={inputStyle()} />
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" autoComplete="street-address" style={inputStyle()} />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" autoComplete="tel" style={inputStyle()} />
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Contraseña (mín. 8)" autoComplete="new-password" style={inputStyle()} />
          <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" style={inputStyle()} />

          {error && (
            <p style={{ fontFamily: BODY, fontSize: '0.78rem', color: '#f2b8b8', background: 'rgba(160,40,40,0.16)', borderLeft: '3px solid #d05a5a', borderRadius: 4, padding: '8px 11px', margin: '2px 0 0' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="pixel-btn pixel-btn-primary" style={{ width: '100%', marginTop: 6, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Creando…' : 'Crear cuenta e ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
