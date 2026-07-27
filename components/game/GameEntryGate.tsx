'use client';

import { useEffect, useState } from 'react';
import { hasGameEntry } from '@/lib/world/gameEntry';

/**
 * Portero de `/juego`.
 *
 * Solo monta el juego si esta pestaña viene de la landing con un login recién
 * validado (ver `lib/world/gameEntry.ts`). Si alguien escribe la URL, la abre
 * desde un marcador o vuelve días después con la cookie todavía viva, se le
 * devuelve a `/` para que pulse "Entrar" e inicie sesión.
 *
 * Mientras decide no pinta nada más que negro —el mismo negro con el que
 * arranca el juego—, así no se ve un parpadeo ni se descargan los ~10 MB del
 * motor a quien no va a entrar.
 */
export default function GameEntryGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (hasGameEntry()) {
      setAllowed(true);
      return;
    }
    // `replace`: el juego no queda en el historial, así "atrás" no rebota.
    window.location.replace('/');
  }, []);

  if (!allowed) {
    return <div aria-hidden="true" className="fixed inset-0" style={{ background: '#000000' }} />;
  }

  return <>{children}</>;
}
