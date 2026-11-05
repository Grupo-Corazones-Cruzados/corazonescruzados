'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { EDIT_INPUT, EditField, QuickEditDialog } from '@/components/ui/EditDialog';

/** La ventanita de borrar la cuenta. Tras borrar, `signOut` apaga lo nativo y saca a la portada. */
export default function EliminarCuenta({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState('');

  const eliminar = async () => {
    setBorrando(true);
    setError('');
    try {
      const res = await fetch('/api/auth/eliminar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar la cuenta');
      await signOut();
    } catch (e) {
      // Dentro de la ventana: un aviso flotante queda detrás de su velo y no se lee.
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta');
      setBorrando(false);
    }
  };

  return (
    <QuickEditDialog
      open={open} title="Eliminar mi cuenta" onClose={() => { setPassword(''); setError(''); onClose(); }} onSave={eliminar}
      saving={borrando} canSave={!!password} saveLabel="Eliminar definitivamente"
    >
      <p className="text-sm text-digi-text mb-3" style={{ fontFamily: 'var(--font-body)' }}>
        Se borrarán tus datos personales y perderás el acceso; no se puede deshacer. Por ley se conservan las
        facturas emitidas. Se cancelarán tus suscripciones activas.
      </p>
      <EditField label="Tu contraseña">
        <input type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} className={EDIT_INPUT} />
      </EditField>
      {error && <p role="alert" className="text-sm text-red-600 mt-2" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>}
    </QuickEditDialog>
  );
}
