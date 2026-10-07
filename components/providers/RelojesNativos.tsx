'use client';

import { useEffect } from 'react';
import { sincronizarRelojesNativos } from '@/lib/movil/reloj-nativo';

/**
 * Mantiene el reloj del teléfono al día con el servidor: al abrir la app, al volver a primer
 * plano (un reloj iniciado o detenido en el computador mientras tanto) y cada vez que una
 * pantalla avisa de un cambio (`avisarCambioDeReloj`). En el navegador no hace nada.
 */
export default function RelojesNativos() {
  useEffect(() => {
    const sincronizar = () => { sincronizarRelojesNativos().catch(() => {}); };
    const alVolver = () => { if (document.visibilityState === 'visible') sincronizar(); };
    sincronizar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('gcc:relojes', sincronizar);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('gcc:relojes', sincronizar);
    };
  }, []);
  return null;
}
