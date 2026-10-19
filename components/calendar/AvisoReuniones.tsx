'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import { type CalendarEvent, expandEvents } from '@/lib/calendar/recurrence';

/** Minutos antes del inicio en que avisa (Fernando, 2026-10-19). De mayor a menor. */
const UMBRALES = [60, 30, 15, 5];
const RECARGA = 5 * 60 * 1000;
const TIC = 20 * 1000;
/** Si se entra con la reunión ya empezada, aún se avisa durante estos minutos. */
const GRACIA = 5;
const CLAVE = 'gcc.avisos-reunion';

const enMinutos = (m: number) => (m >= 60 ? '1 hora' : `${m} min`);
const hora = (d: Date) => d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });

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
 * ⇒ AVISO DE LAS REUNIONES DE MI DÍA (Fernando, 2026-10-19).
 *
 * Avisa 1 hora, 30, 15 y 5 minutos antes de cada evento con hora del calendario propio, en
 * cualquier pantalla del panel. Si se abre el panel tarde, solo sale el aviso del último umbral
 * alcanzado (no cuatro de golpe). Con la pestaña en segundo plano y el permiso concedido, sale
 * también como notificación del sistema.
 *
 * No avisa de los días completos, de los bloques de disponibilidad («Trabajando»…), de las
 * propuestas sin aceptar ni de lo cancelado. Tampoco mientras un admin suplanta a alguien.
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
      eventos.current = (j.data || []).filter((e: CalendarEvent) =>
        e.status === 'confirmed' && !e.all_day && !e.availability_status);
    } catch { /* el próximo intento lo recupera */ }
  }, []);

  const revisar = useCallback(() => {
    const ahora = Date.now();
    const desde = new Date(ahora - GRACIA * 60000);
    const hasta = new Date(ahora + (UMBRALES[0] + 1) * 60000);
    const dados = leerDados();
    let cambio = false;

    for (const ev of expandEvents(eventos.current, desde, hasta)) {
      const inicio = ev.instanceStart.getTime();
      if (inicio < desde.getTime()) continue;
      const faltan = (inicio - ahora) / 60000;
      // El umbral más cercano ya alcanzado: con 20 min por delante toca el de 30.
      const umbral = [...UMBRALES].reverse().find((u) => faltan <= u);
      if (umbral == null) continue;
      const base = `${ev.id}|${inicio}`;
      if (dados[`${base}|${umbral}`]) continue;
      // Se marcan también los umbrales mayores: no se avisan después de uno más cercano.
      for (const u of UMBRALES) if (u >= umbral) dados[`${base}|${u}`] = ahora;
      cambio = true;

      const mins = Math.max(0, Math.round(faltan));
      const cuando = faltan <= 0 ? 'Ya empezó' : mins >= 60 ? 'En 1 hora' : `En ${mins} min`;
      const titulo = `${cuando} · ${ev.title}`;
      const detalle = `${hora(ev.instanceStart)} – ${hora(ev.instanceEnd)}${ev.client_name ? ` · ${ev.client_name}` : ''}`;
      const url = ev.meeting_url || null;

      toast(titulo, {
        id: base,
        description: detalle,
        duration: umbral <= 5 ? Infinity : 30000,
        action: url
          ? { label: 'Unirse', onClick: () => window.open(url, '_blank', 'noopener') }
          : { label: 'Ver en Mi día', onClick: () => router.push('/dashboard/mi-dia') },
      });

      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(titulo, { body: `${detalle}\nAviso de ${enMinutos(umbral)} antes`, tag: base });
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

  // El permiso de notificaciones del sistema se pide en el primer clic: pedirlo sin gesto lo
  // silencia el navegador. Si se rechaza, quedan los avisos dentro del panel.
  useEffect(() => {
    if (!activo || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const pedir = () => { Notification.requestPermission().catch(() => {}); };
    document.addEventListener('pointerdown', pedir, { once: true });
    return () => document.removeEventListener('pointerdown', pedir);
  }, [activo]);

  return null;
}
