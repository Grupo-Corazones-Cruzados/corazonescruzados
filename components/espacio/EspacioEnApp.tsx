'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, WifiOff } from 'lucide-react';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTemaPanel } from '@/components/providers/TemaPanel';
import { esAppInstalada, RUTA_EMBEBIDA } from './api';

const ESPERA_MS = 12000;

/**
 * EL ESPACIO DE TRABAJO EN LA APP DE ESCRITORIO Y EN LA DEL TELÉFONO. Esta página no hace nada por
 * sí misma: enmarca lo que sirve la Mac por Tailscale, y fuera de esa red el marco no llega a
 * cargar. El marco avisa cuando carga, porque desde fuera no se puede saber si falló.
 */
export default function EspacioEnApp({ ruta = RUTA_EMBEBIDA, titulo = 'Espacio de trabajo' }: { ruta?: string; titulo?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { tema, oscuro } = useTemaPanel();
  const [direccion, setDireccion] = useState<string | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-conexion'>('cargando');
  const [intento, setIntento] = useState(0);
  const [completa, setCompleta] = useState(false);

  /**
   * EL MARCO EMPIEZA DONDE EMPIEZA EL CONTENIDO (Fernando, 2026-11-09: en Centralizado el menú 2 tapaba
   * Generación de Contenido). Era `lg:left-16`, pensado para un solo raíl; Centralizado lleva dos. Se
   * mide el borde izquierdo de `<main>` —lo que el layout ya reservó para los menús— en vez de suponerlo.
   */
  const [izquierda, setIzquierda] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const main = document.querySelector('main');
      setIzquierda(window.innerWidth >= 1024 && main ? Math.round(main.getBoundingClientRect().left) : null);
    };
    medir();
    const main = document.querySelector('main');
    const ro = new ResizeObserver(medir);
    if (main) ro.observe(main);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, []);

  useEffect(() => {
    if (!esAppInstalada() || (user && user.role !== 'admin')) { router.replace('/dashboard/tools'); return; }
    fetch('/api/espacio-trabajo/direccion').then((r) => r.json()).then((j) => setDireccion(j.direccion || null)).catch(() => setEstado('sin-conexion'));
  }, [router, user]);

  useEffect(() => {
    if (!direccion) return;
    const origen = new URL(direccion).origin;
    const oir = (e: MessageEvent) => {
      if (e.origin !== origen) return;
      if (e.data === 'espacio-listo') setEstado('listo');
      if (e.data === 'espacio-modal-abierto') setCompleta(true);
      if (e.data === 'espacio-modal-cerrado') setCompleta(false);
    };
    window.addEventListener('message', oir);
    const t = setTimeout(() => setEstado((x) => (x === 'listo' ? x : 'sin-conexion')), ESPERA_MS);
    return () => { window.removeEventListener('message', oir); clearTimeout(t); };
  }, [direccion, intento]);

  const reintentar = useCallback(() => { setEstado('cargando'); setIntento((i) => i + 1); }, []);
  const src = direccion ? `${direccion}${ruta}?tema=${encodeURIComponent(tema)}&oscuro=${oscuro ? 1 : 0}` : null;

  return (
    // Toda la pantalla bajo la cabecera de la sección (`CabeceraSeccion`): en las apps es una herramienta
    // aparte de Progreso, sin pie ni márgenes (Fernando, 2026-11-08: «no está aprovechando el espacio»).
    // ⚠️ Con un formulario abierto, la caja sube de capa con el marco: su `z-10` es un contexto propio y
    // el marco `fixed` no podía pasar por encima del pie de la app, que tapaba los botones (2026-11-10).
    <div style={izquierda != null ? { left: izquierda } : undefined}
      className={`fixed inset-x-0 bottom-[var(--pie-panel)] top-[calc(3.5rem+var(--seguro-arriba))] lg:top-0 lg:left-16 ${completa ? 'z-[2147483000]' : 'z-10'} bg-digi-card overflow-hidden`}>
      {src && <iframe key={intento} src={src} title={titulo} allow="microphone; clipboard-read; clipboard-write" className={`border-0 ${completa ? 'fixed inset-0 z-[2147483000] w-screen h-dvh' : 'w-full h-full'} ${estado === 'listo' ? '' : 'invisible'}`} />}
      {estado === 'cargando' && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
      {estado === 'sin-conexion' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <WifiOff className="w-6 h-6 text-digi-muted" />
          <p className="text-[13.5px] text-digi-text">No se pudo conectar con tu Mac. Revisa que Tailscale esté activo y que la Mac esté encendida.</p>
          <button type="button" className={BTN_SECONDARY} onClick={reintentar}>Reintentar</button>
        </div>
      )}
    </div>
  );
}
