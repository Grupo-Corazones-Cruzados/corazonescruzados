'use client';

import { useEffect, useRef, useState } from 'react';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  CharacterSprite,
  type CharacterConfig,
  type SpriteDirection,
} from './CharacterCreator';

const SPEED = 2.4;

type AuthStatus = {
  hasPassword: boolean;
  emailVerified: boolean;
  authenticated: boolean;
  pendingEmail?: string | null;
};

export default function CharacterGameplay({
  config,
  initialAuth,
  isReturning = false,
}: {
  config: CharacterConfig;
  initialAuth?: AuthStatus;
  isReturning?: boolean;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [direction, setDirection] = useState<SpriteDirection>('n');
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  const keysRef = useRef<Set<string>>(new Set());
  const [auth, setAuth] = useState<AuthStatus>(() => {
    const base: AuthStatus = initialAuth ?? {
      hasPassword: false,
      emailVerified: false,
      authenticated: true,
    };
    // Returning players must always re-enter their password on each
    // entry to the world, even if the auth cookie is still valid.
    return isReturning ? { ...base, authenticated: false } : base;
  });

  // Brand-new player (just created character this session) plays freely.
  // Returning players must set up password (1st return) or log in (subsequent).
  const [passkeyOffer, setPasskeyOffer] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const showSetup = isReturning && !auth.hasPassword;
  const showLogin = isReturning && auth.hasPassword && !auth.authenticated;
  const overlayVisible = showSetup || showLogin || passkeyOffer;
  const locked = overlayVisible;

  // ── Walk frame cycler ────────────────────────────────────────────
  useEffect(() => {
    if (!walking) {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f >= 8 ? 1 : f + 1));
    }, 130);
    return () => window.clearInterval(id);
  }, [walking]);

  // ── Keyboard handlers (gated by `locked`) ────────────────────────
  useEffect(() => {
    const keyToDir = (key: string | undefined): SpriteDirection | null => {
      if (typeof key !== 'string') return null;
      const k = key.toLowerCase();
      if (k === 'arrowup' || k === 'w') return 'n';
      if (k === 'arrowdown' || k === 's') return 's';
      if (k === 'arrowleft' || k === 'a') return 'w';
      if (k === 'arrowright' || k === 'd') return 'e';
      return null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      keysRef.current.add(e.key);
      setDirection(dir);
      setWalking(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key);
      if (!dir) return;
      keysRef.current.delete(e.key);
      if (keysRef.current.size === 0) setWalking(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [locked]);

  // ── Movement loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!walking) return;
    let raf = 0;
    const tick = () => {
      const vx = direction === 'w' ? -SPEED : direction === 'e' ? SPEED : 0;
      const vy = direction === 'n' ? -SPEED : direction === 's' ? SPEED : 0;
      setPos((p) => ({ x: p.x + vx, y: p.y + vy }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [walking, direction]);

  // ── Poll auth status while overlay is open (catch verify/login from
  //    other tabs or after returning from email link) ───────────────
  useEffect(() => {
    if (!overlayVisible) return;
    const refresh = async () => {
      try {
        const r = await fetch('/api/character/me');
        const j = await r.json();
        if (j?.exists) {
          setAuth((prev) => ({
            hasPassword: !!j.hasPassword,
            emailVerified: !!j.emailVerified,
            // Polling must NOT auto-grant authenticated state, even if
            // a stale auth cookie is still valid on the server. Login
            // can only succeed via the explicit LoginForm submission.
            authenticated: prev.authenticated,
            pendingEmail: j.pendingEmail ?? null,
          }));
        }
      } catch {
        /* noop */
      }
    };
    const id = window.setInterval(refresh, 4000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [overlayVisible]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#000',
        overflow: 'hidden',
        animation: 'pixelFadeIn 0.6s ease-out',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          willChange: 'transform',
        }}
      >
        <CharacterSprite
          config={config}
          direction={direction}
          frame={frame}
          scale={3}
        />
      </div>

      {showSetup && (
        <SignupForm
          alias={config.name}
          onSignedUp={(email) =>
            setAuth({
              hasPassword: true,
              emailVerified: false,
              authenticated: false,
              pendingEmail: email,
            })
          }
          pendingEmail={auth.pendingEmail ?? null}
        />
      )}

      {showLogin && (
        <LoginForm
          onLoggedIn={async () => {
            setAuth({
              hasPassword: true,
              emailVerified: true,
              authenticated: true,
            });
            // After password login, offer to register a passkey on
            // this device if the browser supports WebAuthn and the
            // account doesn't already have one.
            try {
              if (
                typeof window !== 'undefined' &&
                'PublicKeyCredential' in window
              ) {
                const status = await fetch(
                  '/api/character/auth/passkey/status',
                ).then((r) => r.json());
                if (!status?.hasPasskeys) setPasskeyOffer(true);
              }
            } catch {
              /* noop */
            }
          }}
        />
      )}

      {passkeyOffer && (
        <PasskeyOfferDialog
          onSkip={() => setPasskeyOffer(false)}
          onRegistered={() => {
            setPasskeyRegistered(true);
            window.setTimeout(() => setPasskeyOffer(false), 1200);
          }}
          registered={passkeyRegistered}
        />
      )}
    </div>
  );
}

function PasskeyOfferDialog({
  onSkip,
  onRegistered,
  registered,
}: {
  onSkip: () => void;
  onRegistered: () => void;
  registered: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = async () => {
    setBusy(true);
    setError(null);
    const res = await tryRegisterPasskey();
    setBusy(false);
    if (res.ok) onRegistered();
    else setError(res.error);
  };
  return (
    <FormShell
      title={registered ? '¡Passkey registrada!' : 'Usa tu huella o Face ID'}
      subtitle={
        registered
          ? 'La próxima vez podrás entrar sin contraseña'
          : 'Asocia este dispositivo para entrar más rápido la próxima vez'
      }
    >
      {!registered && (
        <p
          style={{
            fontSize: '0.7rem',
            lineHeight: 1.6,
            margin: '0 0 16px',
            color: '#cbd5e1',
          }}
        >
          Usa el sensor biométrico de tu dispositivo (Touch ID, Face ID,
          huella, PIN) para crear una passkey. Después podrás iniciar sesión
          en un solo paso.
        </p>
      )}
      {error && (
        <div
          style={{
            fontSize: '0.62rem',
            color: '#ff6f6f',
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!registered && (
          <button
            type="button"
            disabled={busy}
            onClick={register}
            className="pixel-btn pixel-btn-primary"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Registrando...' : 'Registrar passkey'}
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="pixel-btn pixel-btn-secondary"
        >
          {registered ? 'Continuar' : 'Ahora no'}
        </button>
      </div>
    </FormShell>
  );
}

function FormShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1,
        animation: 'pixelFadeIn 0.5s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#131923',
          border: '2px solid var(--color-accent)',
          padding: '28px 26px',
          fontFamily: "'Silkscreen', cursive",
          color: '#e5e5e5',
          boxShadow:
            '6px 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(75,45,142,0.35)',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            letterSpacing: '0.22em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: subtitle ? 4 : 18,
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.1em',
              color: 'rgba(225,215,255,0.7)',
              textAlign: 'center',
              marginBottom: 18,
            }}
          >
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function input(extra?: React.CSSProperties): React.CSSProperties {
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
    ...extra,
  };
}

function SignupForm({
  alias,
  pendingEmail,
  onSignedUp,
}: {
  alias: string;
  pendingEmail: string | null;
  onSignedUp: (email: string) => void;
}) {
  const [email, setEmail] = useState(pendingEmail ?? '');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(!!pendingEmail);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Correo inválido');
      return;
    }
    if (pwd.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (pwd !== pwd2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo enviar el correo');
        return;
      }
      setSent(true);
      onSignedUp(email.trim());
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <FormShell
        title="Confirma tu correo"
        subtitle={`Te enviamos un enlace a ${email}`}
      >
        <p
          style={{
            fontSize: '0.7rem',
            lineHeight: 1.6,
            margin: '6px 0 14px',
            color: '#cbd5e1',
          }}
        >
          Abre el correo y haz clic en el botón de confirmación para activar tu
          cuenta. Mientras tanto no podrás continuar en el juego.
        </p>
        <p
          style={{
            fontSize: '0.6rem',
            color: 'rgba(225,215,255,0.55)',
            margin: '0 0 14px',
            lineHeight: 1.6,
          }}
        >
          Cuando confirmes, esta pantalla se actualizará automáticamente.
        </p>
        <button
          type="button"
          className="pixel-btn pixel-btn-secondary"
          style={{ width: '100%' }}
          onClick={() => setSent(false)}
        >
          Cambiar correo
        </button>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="Crea tu cuenta"
      subtitle={`Para ${alias} — guarda tu progreso`}
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          autoComplete="email"
          autoFocus
          style={input()}
        />
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Contraseña (mín. 8)"
          autoComplete="new-password"
          style={input()}
        />
        <input
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="Confirma la contraseña"
          autoComplete="new-password"
          style={input()}
        />
        {error && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.05em',
              color: '#ff6f6f',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="pixel-btn pixel-btn-primary"
          style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Enviando...' : 'Enviar correo'}
        </button>
      </form>
    </FormShell>
  );
}

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    fetch('/api/character/auth/passkey/status')
      .then((r) => r.json())
      .then((j) => setHasPasskeys(!!j?.hasPasskeys))
      .catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/login', {
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
      setSubmitting(false);
    }
  };

  const loginWithPasskey = async () => {
    setError(null);
    setPasskeyBusy(true);
    try {
      const begin = await fetch('/api/character/auth/passkey/login/begin', {
        method: 'POST',
      });
      const opts = await begin.json();
      if (!begin.ok) {
        setError(opts?.error ?? 'No se pudo iniciar passkey');
        return;
      }
      const credential = await startAuthentication({ optionsJSON: opts });
      const finish = await fetch('/api/character/auth/passkey/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credential),
      });
      const fJson = await finish.json();
      if (!finish.ok) {
        setError(fJson?.error ?? 'Passkey rechazada');
        return;
      }
      onLoggedIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de passkey';
      // User canceled the prompt → quietly ignore (no scary red text).
      if (!/cancel|abort|timeout|allowed/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  return (
    <FormShell
      title="Continúa tu partida"
      subtitle="Usa tu passkey o ingresa con correo + contraseña"
    >
      {hasPasskeys && (
        <button
          type="button"
          onClick={loginWithPasskey}
          disabled={passkeyBusy}
          className="pixel-btn pixel-btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 10,
            opacity: passkeyBusy ? 0.6 : 1,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M12 2a5 5 0 0 1 5 5v3" />
            <path d="M12 2a5 5 0 0 0-5 5v3" />
            <rect x="5" y="10" width="14" height="11" rx="1" />
            <path d="M12 14v4" />
          </svg>
          {passkeyBusy ? 'Autenticando...' : 'Usar passkey'}
        </button>
      )}
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          autoComplete="email"
          autoFocus={!hasPasskeys}
          style={input()}
        />
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          style={input()}
        />
        {error && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.05em',
              color: '#ff6f6f',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="pixel-btn pixel-btn-secondary"
          style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Entrando...' : 'Entrar con contraseña'}
        </button>
      </form>
    </FormShell>
  );
}

export async function tryRegisterPasskey(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const begin = await fetch(
      '/api/character/auth/passkey/register/begin',
      {
        method: 'POST',
      },
    );
    const opts = await begin.json();
    if (!begin.ok) return { ok: false, error: opts?.error ?? 'No autorizado' };
    const attestation = await startRegistration({ optionsJSON: opts });
    const finish = await fetch(
      '/api/character/auth/passkey/register/finish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      },
    );
    const j = await finish.json();
    if (!finish.ok) return { ok: false, error: j?.error ?? 'Falló registro' };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
