'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;

export default function ConfirmSubscriptionPage() {
  const search = useSearchParams();
  const token = search.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) { setState('err'); setError('Falta el token'); return; }
    fetch(`/api/calendar/subscribers/verify?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Token inválido');
        setEmail(data.email || '');
        setState('ok');
      })
      .catch((err) => {
        setError(err?.message || 'Token inválido');
        setState('err');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-digi-dark p-6">
      <div className="pixel-card max-w-md w-full text-center space-y-3">
        {state === 'loading' && (
          <div className="text-[12px] text-digi-muted" style={pf}>Verificando…</div>
        )}
        {state === 'ok' && (
          <>
            <div className="text-sm text-accent-glow" style={pf}>SUSCRIPCIÓN CONFIRMADA</div>
            <div className="text-[11px] text-digi-text">
              {email
                ? <>Recibirás notificaciones en <strong>{email}</strong>.</>
                : 'Tu suscripción fue confirmada correctamente.'}
            </div>
          </>
        )}
        {state === 'err' && (
          <>
            <div className="text-sm text-red-400" style={pf}>NO SE PUDO CONFIRMAR</div>
            <div className="text-[11px] text-digi-muted">{error}</div>
          </>
        )}
      </div>
    </div>
  );
}
