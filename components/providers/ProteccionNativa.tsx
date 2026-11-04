'use client';

import { useEffect } from 'react';
import { apagarProteccionNativa, configurarNativo, estadoNativo } from '@/lib/movil/control-psicosocial';

/**
 * Al abrir la app, si este teléfono tiene el rastreo activo, lo alinea con el servidor: lo vuelve a
 * levantar (el sistema pudo cerrarlo) y lo apaga si ya no corresponde (retiró el consentimiento,
 * dejó de ser miembro o entró otra persona). Si no está activo no hace nada: ni pide permisos ni
 * llama al servidor, y por eso quien no es miembro no se entera de que esto existe.
 */
export default function ProteccionNativa() {
  useEffect(() => {
    const sincronizar = async () => {
      const n = await estadoNativo();
      if (!n?.activo) return;
      const r = await fetch('/api/centralized/control-psicosocial', { cache: 'no-store' });
      // Sin sesión no se toca nada: el teléfono usa su llave. Un fallo del servidor tampoco.
      if (r.status === 403) { await apagarProteccionNativa(); return; }
      if (!r.ok) return;
      const { data } = await r.json();
      if (n.userId !== data.user_id || (!data.ubicacion_activa && !data.voz_activa)) {
        await apagarProteccionNativa();
        return;
      }
      await configurarNativo(data.user_id, data.ubicacion_activa, data.voz_activa);
    };
    const correr = () => { sincronizar().catch(() => {}); };
    const alVolver = () => { if (document.visibilityState === 'visible') correr(); };
    correr();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);
  return null;
}
