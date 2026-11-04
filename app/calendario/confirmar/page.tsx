'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import MarcoPublico, { AvisoPublico, CargandoPublico } from '@/components/public/MarcoPublico';

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

  if (state === 'loading') return <CargandoPublico texto="Verificando…" />;
  if (state === 'ok') {
    return (
      <AvisoPublico icon={CheckCircle2} titulo="Suscripción confirmada">
        {email
          ? <>Recibirás notificaciones en <strong className="text-digi-text">{email}</strong>.</>
          : 'Tu suscripción fue confirmada correctamente.'}
      </AvisoPublico>
    );
  }
  return <AvisoPublico icon={XCircle} titulo="No se pudo confirmar">{error}</AvisoPublico>;
}

export default function ConfirmSubscriptionPage() {
  return (
    <MarcoPublico>
      <div className="max-w-md mx-auto">
        <Suspense fallback={<CargandoPublico texto="Verificando…" />}>
          <ConfirmSubscriptionInner />
        </Suspense>
      </div>
    </MarcoPublico>
  );
}
