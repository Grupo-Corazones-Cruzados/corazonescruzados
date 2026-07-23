'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

// Dashboard Fluent (.corp): las fuentes resuelven a Segoe UI.
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

function ConfirmSubscriptionInner() {
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
    <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-6 max-w-md w-full text-center space-y-2">
      {state === 'loading' && (
        <div className="inline-flex items-center gap-2 text-[13px] text-digi-muted" style={mf}>
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
        </div>
      )}
      {state === 'ok' && (
        <>
          <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto" />
          <div className="text-[15px] font-semibold text-digi-text" style={df}>Suscripción confirmada</div>
          <div className="text-[13px] text-digi-muted" style={mf}>
            {email
              ? <>Recibirás notificaciones en <strong className="text-digi-text">{email}</strong>.</>
              : 'Tu suscripción fue confirmada correctamente.'}
          </div>
        </>
      )}
      {state === 'err' && (
        <>
          <XCircle className="w-8 h-8 text-red-600 mx-auto" />
          <div className="text-[15px] font-semibold text-digi-text" style={df}>No se pudo confirmar</div>
          <div className="text-[13px] text-digi-muted" style={mf}>{error}</div>
        </>
      )}
    </div>
  );
}

export default function ConfirmSubscriptionPage() {
  return (
    <div className="corp page-dark min-h-screen flex items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-6 max-w-md w-full text-center">
            <div className="inline-flex items-center gap-2 text-[13px] text-digi-muted" style={mf}>
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
            </div>
          </div>
        }
      >
        <ConfirmSubscriptionInner />
      </Suspense>
    </div>
  );
}
