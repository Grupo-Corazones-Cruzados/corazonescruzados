'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WifiOff } from 'lucide-react';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTemaPanel } from '@/components/providers/TemaPanel';

const ESPERA_MS = 12000;

/**
 * EL ESPACIO DE TRABAJO EN LA APP DE ESCRITORIO Y EN LA DEL TELÉFONO. Esta página no hace nada por
 * sí misma: enmarca lo que sirve la Mac por Tailscale, y fuera de esa red el marco no llega a
 * cargar. El marco avisa cuando carga, porque desde fuera no se puede saber si falló.
 */
export default function EspacioEnApp() {
  const router = useRouter();
  const { user } = useAuth();
  const { tema, oscuro } = useTemaPanel();
  const [direccion, setDireccion] = useState<string | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-conexion'>('cargando');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const w = window as any;
    const enApp = !!w.Capacitor?.isNativePlatform?.() || window.matchMedia('(display-mode: standalone)').matches;
    if (!enApp || (user && user.role !== 'admin')) { router.replace('/dashboard/admin'); return; }
    fetch('/api/espacio-trabajo/direccion').then((r) => r.json()).then((j) => setDireccion(j.direccion || null)).catch(() => setEstado('sin-conexion'));
  }, [router, user]);

  useEffect(() => {
    if (!direccion) return;
    const origen = new URL(direccion).origin;
    const oir = (e: MessageEvent) => { if (e.origin === origen && e.data === 'espacio-listo') setEstado('listo'); };
    window.addEventListener('message', oir);
    const t = setTimeout(() => setEstado((x) => (x === 'listo' ? x : 'sin-conexion')), ESPERA_MS);
    return () => { window.removeEventListener('message', oir); clearTimeout(t); };
  }, [direccion, intento]);

  const reintentar = useCallback(() => { setEstado('cargando'); setIntento((i) => i + 1); }, []);
  const src = direccion ? `${direccion}/espacio?tema=${encodeURIComponent(tema)}&oscuro=${oscuro ? 1 : 0}` : null;

  return (
    <PanelHastaElPie desdeAncho={0} minimo={320} desplazar={false} className="relative bg-digi-card border border-digi-border rounded-lg overflow-hidden">
      {src && <iframe key={intento} src={src} title="Espacio de trabajo" allow="microphone" className={`w-full h-full border-0 ${estado === 'listo' ? '' : 'invisible'}`} />}
      {estado === 'cargando' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
      {estado === 'sin-conexion' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <WifiOff className="w-6 h-6 text-digi-muted" />
          <p className="text-[13.5px] text-digi-text">No se pudo conectar con tu Mac. Revisa que Tailscale esté activo y que la Mac esté encendida.</p>
          <button type="button" className={BTN_SECONDARY} onClick={reintentar}>Reintentar</button>
        </div>
      )}
    </PanelHastaElPie>
  );
}
