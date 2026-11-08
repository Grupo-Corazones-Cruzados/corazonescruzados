'use client';

import { useEffect, useState } from 'react';
import { esAppInstalada } from '@/components/espacio/api';

export type RutasEspacio = { espacio: string; gumdramon: string };

/**
 * A DÓNDE ABRIR EL ESPACIO DE TRABAJO Y GUMDRAMON — o `null` si aquí no existen.
 * En la Mac (instancia local) se abren directo. En las apps, en un marco, por la red privada
 * (Tailscale). En una pestaña normal de la web no existen. Antes vivía en el módulo Admin; desde el
 * 2026-11-08 son herramientas (`lib/herramientas/catalogo.ts`, Fernando).
 */
export function useRutasEspacio(): RutasEspacio | null {
  const [rutas, setRutas] = useState<RutasEspacio | null>(null);
  useEffect(() => {
    const enApp = esAppInstalada();
    const enMarco = { espacio: '/dashboard/admin/espacio-app', gumdramon: '/dashboard/admin/gumdramon-app' };
    fetch('/api/espacio-trabajo/estado')
      .then((r) => setRutas(r.ok ? { espacio: '/dashboard/admin/espacio', gumdramon: '/gumdramon' } : enApp ? enMarco : null))
      .catch(() => setRutas(enApp ? enMarco : null));
  }, []);
  return rutas;
}
