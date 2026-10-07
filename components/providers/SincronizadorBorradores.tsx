'use client';

import { useEffect } from 'react';
import { hayPendientes } from '@/lib/borradores/almacen';
import { sincronizar } from '@/lib/borradores/sincronizar';

/**
 * Sube los borradores hechos SIN CONEXIÓN en cuanto vuelve la red, en cualquier pantalla del
 * panel (Fernando, 2026-10-07: «una vez el usuario recupere conexión ese proyecto debe ir
 * automáticamente al estado borrador»). Y, con conexión, pide al service worker que vuelva a
 * guardar la pantalla de Borradores: tras cada despliegue cambian sus archivos.
 *
 * Solo dentro del panel: en el sitio público no hay borradores ni sesión que comprobar.
 */
export default function SincronizadorBorradores() {
  useEffect(() => {
    if (!window.location.pathname.startsWith('/dashboard')) return;
    const subir = async () => {
      if (!navigator.onLine) return;
      try {
        // Siempre una vuelta al entrar (guarda la cuenta y las listas para usar sin red);
        // al volver la red, solo si hay algo pendiente.
        await sincronizar();
      } catch { /* se reintenta en la siguiente */ }
    };
    const alVolver = async () => { if (await hayPendientes()) subir(); };
    const t = setTimeout(() => {
      subir();
      navigator.serviceWorker?.controller?.postMessage('guardar-borradores');
    }, 4000);
    window.addEventListener('online', alVolver);
    return () => { clearTimeout(t); window.removeEventListener('online', alVolver); };
  }, []);
  return null;
}
