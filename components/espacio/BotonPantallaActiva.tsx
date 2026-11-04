'use client';

import { useEffect } from 'react';
import { Sun, SunDim } from 'lucide-react';
import { useWakeLock } from '@/hooks/useWakeLock';

const LLAVE = 'espacio_pantalla_activa';

function leer() {
  try { return localStorage.getItem(LLAVE) === '1'; } catch { return false; }
}
function guardar(activa: boolean) {
  try { localStorage.setItem(LLAVE, activa ? '1' : '0'); } catch { /* solo es la preferencia */ }
}

/**
 * Evita que el teléfono se apague mientras el espacio de trabajo está abierto. Se monta solo en esa
 * pantalla: al salir de ella, el teléfono vuelve a apagarse como siempre. La preferencia se recuerda.
 */
export default function BotonPantallaActiva({ className = '' }: { className?: string }) {
  const { isActive, isSupported, request, release } = useWakeLock();

  useEffect(() => { if (leer()) request(); }, [request]);

  if (!isSupported) return null;
  const etiqueta = isActive ? 'Dejar que la pantalla se apague' : 'Mantener la pantalla encendida';
  return (
    <button
      type="button"
      onClick={() => { guardar(!isActive); if (isActive) release(); else request(); }}
      aria-pressed={isActive}
      aria-label={etiqueta}
      title={etiqueta}
      className={`w-11 h-11 flex items-center justify-center rounded-lg transition-[filter] duration-150 hover:brightness-125 active:brightness-150 ${isActive ? 'text-amber-400' : 'text-digi-text'} ${className}`}
    >
      {isActive ? <Sun className="w-5 h-5" /> : <SunDim className="w-5 h-5" />}
    </button>
  );
}
