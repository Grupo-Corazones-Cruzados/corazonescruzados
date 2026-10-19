'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { BTN_SECONDARY } from '@/components/ui/Button';

type Estado = 'cargando' | 'activo' | 'inactivo' | 'bloqueado' | 'instalar' | 'sin-soporte';

const esIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** El service worker se registra al cargar la página (`RegistroServiceWorker`); si aún no, se registra aquí. */
async function registro(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js');
}

/**
 * ⇒ «AVISOS» DE MI DÍA (Fernando, 2026-10-19): activa en ESTE dispositivo el push de las
 * reuniones (1 h, 30, 15 y 5 min antes) aunque el panel esté cerrado. Cada teléfono u ordenador
 * se activa por separado. En iPhone el push solo existe con la app instalada en la pantalla de
 * inicio; sin instalar, el botón explica cómo.
 */
export default function BotonAvisosPush({ className = '' }: { className?: string }) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
        setEstado(esIos() && !instalada() ? 'instalar' : 'sin-soporte');
        return;
      }
      if (Notification.permission === 'denied') { setEstado('bloqueado'); return; }
      try {
        const r = await navigator.serviceWorker.getRegistration('/');
        const s = r ? await r.pushManager.getSubscription() : null;
        setEstado(s && Notification.permission === 'granted' ? 'activo' : 'inactivo');
      } catch { setEstado('inactivo'); }
    })();
  }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'inactivo');
        if (permiso === 'denied') toast.error('El navegador bloqueó las notificaciones de GCC World. Permítelas en los ajustes del sitio.');
        return;
      }
      const rc = await fetch('/api/push/clave');
      if (!rc.ok) throw new Error('Los avisos al móvil aún no están configurados');
      const { clave } = await rc.json();
      const reg = await registro();
      await navigator.serviceWorker.ready;
      const sus = (await reg.pushManager.getSubscription())
        || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
      const r = await fetch('/api/push/suscripcion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sus.toJSON()),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar');
      setEstado('activo');
      toast.success('Avisos activados en este dispositivo');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron activar los avisos');
    } finally { setOcupado(false); }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sus = reg ? await reg.pushManager.getSubscription() : null;
      if (sus) {
        await fetch('/api/push/suscripcion', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sus.endpoint }),
        });
        await sus.unsubscribe();
      }
      setEstado('inactivo');
      toast.success('Avisos desactivados en este dispositivo');
    } catch { toast.error('No se pudieron desactivar los avisos'); }
    finally { setOcupado(false); }
  };

  if (estado === 'cargando' || estado === 'sin-soporte') return null;

  const pulsar = () => {
    if (estado === 'activo') return desactivar();
    if (estado === 'inactivo') return activar();
    if (estado === 'instalar') {
      toast('Para recibir avisos en el iPhone, instala GCC World', {
        description: 'En Safari toca Compartir → «Añadir a pantalla de inicio», abre la app desde el icono y activa los avisos ahí.',
        duration: 12000,
      });
      return;
    }
    toast.error('Las notificaciones están bloqueadas para GCC World. Permítelas en los ajustes del navegador y vuelve a intentarlo.');
  };

  const Icono = estado === 'activo' ? BellRing : estado === 'bloqueado' ? BellOff : Bell;
  return (
    <button onClick={pulsar} disabled={ocupado} aria-pressed={estado === 'activo'}
      title={estado === 'activo' ? 'Desactivar los avisos de reunión en este dispositivo' : 'Recibir avisos de reunión en este dispositivo'}
      className={`${BTN_SECONDARY} ${estado === 'activo' ? '!text-accent !border-accent/40' : ''} ${className}`}>
      <Icono className="w-4 h-4" /> {estado === 'activo' ? 'Avisos activos' : 'Activar avisos'}
    </button>
  );
}
