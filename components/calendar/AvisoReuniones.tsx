'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import type { CalendarEvent } from '@/lib/calendar/recurrence';
import { avisosPendientes, claveAviso, textoAviso, UMBRALES } from '@/lib/calendar/avisos';

const RECARGA = 5 * 60 * 1000;
const TIC = 20 * 1000;
const CLAVE = 'gcc.avisos-reunion';

/** Avisos ya dados: viven en el navegador para que una recarga u otra pestaña no los repitan. */
function leerDados(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch { return {}; }
}
function guardarDados(d: Record<string, number>) {
  const limite = Date.now() - 2 * 24 * 3600 * 1000;
  for (const k of Object.keys(d)) if (d[k] < limite) delete d[k];
  try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* sin almacenamiento: puede repetir */ }
}

/**
 * ⇒ AVISO DE LAS REUNIONES DE MI DÍA DENTRO DEL PANEL (Fernando, 2026-10-19).
 *
 * Avisa 1 hora, 30, 15 y 5 minutos antes de cada evento con hora del calendario propio, en
 * cualquier pantalla del panel. Reglas (qué se avisa y cuándo) en `lib/calendar/avisos.ts`,
 * compartidas con el push al móvil, que avisa aunque el panel esté cerrado (`BotonAvisosPush`).
 *
 * Con la pestaña en segundo plano y el permiso concedido sale también como notificación del
 * sistema, con la MISMA etiqueta que el push: si llegan los dos, queda uno.
 */
export default function AvisoReuniones() {
  const { user, suplantacion } = useAuth();
  const router = useRouter();
  const eventos = useRef<CalendarEvent[]>([]);
  const activo = !!user?.member_id && !suplantacion;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/members/calendar/events');
      if (!r.ok) return;
      const j = await r.json();
      eventos.current = j.data || [];
    } catch { /* el próximo intento lo recupera */ }
  }, []);

  const revisar = useCallback(() => {
    const ahora = Date.now();
    const dados = leerDados();
    let cambio = false;

    for (const { ev, umbral, faltan, inicio } of avisosPendientes(eventos.current, ahora)) {
      if (dados[claveAviso(ev, inicio, umbral)]) continue;
      // Se marcan también los umbrales mayores: no se avisan después de uno más cercano.
      for (const u of UMBRALES) if (u >= umbral) dados[claveAviso(ev, inicio, u)] = ahora;
      cambio = true;

      const { titulo, detalle } = textoAviso(ev, faltan);
      const url = ev.meeting_url || null;
      const etiqueta = `reunion-${ev.id}-${inicio}`;

      toast(titulo, {
        id: etiqueta,
        description: detalle,
        duration: umbral <= 5 ? Infinity : 30000,
        action: url
          ? { label: 'Unirse', onClick: () => window.open(url, '_blank', 'noopener') }
          : { label: 'Ver en Mi día', onClick: () => router.push('/dashboard/mi-dia') },
      });

      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(titulo, { body: detalle, tag: etiqueta, icon: '/icono-192.png' });
          n.onclick = () => { window.focus(); if (url) window.open(url, '_blank', 'noopener'); n.close(); };
        } catch { /* algunos navegadores solo la permiten desde un service worker */ }
      }
    }
    if (cambio) guardarDados(dados);
  }, [router]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    cargar().then(() => { if (vivo) revisar(); });
    const recarga = setInterval(cargar, RECARGA);
    const tic = setInterval(revisar, TIC);
    const alVolver = () => { if (!document.hidden) cargar().then(revisar); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      clearInterval(recarga); clearInterval(tic);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo, cargar, revisar]);

  return null;
}
