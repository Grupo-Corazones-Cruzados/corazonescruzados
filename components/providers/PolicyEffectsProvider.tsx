'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface PolicyDetailDoc { id: number; title: string; purpose: string; conduct: string; clauses: { title: string; text: string }[] }
export interface ActivePolicy { id: number; name: string; activatedAt: string | null; messages: string[]; details: PolicyDetailDoc[] }
export interface PolicyEffects { policies: ActivePolicy[]; blockedModules: string[] }

const Ctx = createContext<PolicyEffects>({ policies: [], blockedModules: [] });
export const usePolicyEffects = () => useContext(Ctx);

/**
 * Carga los efectos ACTIVOS de "Comandos Violeta" (mensajes permanentes + módulos
 * bloqueados) y los provee a todo el dashboard (banner + sidebar + guard de acceso).
 * Refresca al volver a la pestaña, por si un admin cambió las políticas.
 */
export default function PolicyEffectsProvider({ children }: { children: React.ReactNode }) {
  const [effects, setEffects] = useState<PolicyEffects>({ policies: [], blockedModules: [] });
  const pathname = usePathname();

  useEffect(() => {
    let ok = true;
    const load = () =>
      fetch('/api/centralized/comandos/active')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (ok && d?.data) setEffects({ policies: d.data.policies || [], blockedModules: d.data.blockedModules || [] }); })
        .catch(() => {});
    load(); // refresca en cada navegación del dashboard (refleja cambios recientes de políticas)
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { ok = false; document.removeEventListener('visibilitychange', onVis); };
  }, [pathname]);

  return <Ctx.Provider value={effects}>{children}</Ctx.Provider>;
}
