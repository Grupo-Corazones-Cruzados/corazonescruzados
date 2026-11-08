'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { appDeTelefono } from '@/lib/sitio/appDeTelefono';
import { abrirFuera } from '@/lib/movil/abrir-fuera';

const INSTALAR = 'https://app.grupocc.org/dashboard/tools?herramienta=gcc-centralizado';

/**
 * Dentro de GCC Progreso, Centralizado no se abre: los miembros pasan a GCC Centralizado, su app, que
 * es la que tiene los permisos que Progreso no pide (Fernando, 2026-11-05). En la web y en la propia
 * GCC Centralizado no hace nada.
 */
export default function PuertaCentralizado({ children }: { children: ReactNode }) {
  const [enProgreso, setEnProgreso] = useState<boolean | null>(null);
  const [falta, setFalta] = useState(false);
  useEffect(() => { setEnProgreso(appDeTelefono() === 'progreso'); }, []);

  if (enProgreso === null) return null;
  if (!enProgreso) return <>{children}</>;

  const abrir = async () => {
    if (!(await abrirFuera('gcccentralizado://abrir'))) setFalta(true);
  };
  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[60vh] px-6" style={{ fontFamily: 'var(--font-body)' }}>
      <h1 className="text-xl font-semibold text-digi-text">Centralizado</h1>
      <p className="text-sm text-digi-muted max-w-sm">
        {falta ? 'Aún no la tienes en este teléfono. Descárgala desde Herramientas, en tu navegador.' : 'Este módulo se abre en GCC Miembros, la app de los miembros.'}
      </p>
      <div className="flex gap-2">
        {falta && <button onClick={() => abrirFuera(INSTALAR)} className={BTN_SECONDARY}>Descargar</button>}
        <button onClick={abrir} className={BTN_PRIMARY}>Abrir GCC Miembros</button>
      </div>
    </div>
  );
}
