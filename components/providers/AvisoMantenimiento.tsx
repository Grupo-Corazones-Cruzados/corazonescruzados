'use client';

import { useEffect, useState } from 'react';

/**
 * Si el servidor cae con la app abierta, el Worker de Cloudflare (`services/mantenimiento/worker.js`)
 * responde 503 con `x-gcc-mantenimiento`. Aquí se detecta en cualquier llamada y se tapa la pantalla con
 * el mismo aviso que ve quien entra de nuevo. Cada 30 s se vuelve a preguntar y, al volver, se recarga.
 *
 * Colores escritos a mano a propósito, como en `movil/www/error.html`: este aviso tiene que verse igual
 * fuera del tema del panel (sitio, inicio de sesión) y dentro de él.
 */
let instalado = false;
const EVENTO = 'gcc:mantenimiento';

export default function AvisoMantenimiento() {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    if (!instalado && typeof window !== 'undefined') {
      instalado = true;
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const r = await original(...args);
        if (r.status === 503 && r.headers.get('x-gcc-mantenimiento')) window.dispatchEvent(new Event(EVENTO));
        return r;
      };
    }
    const alAvisar = () => setActivo(true);
    window.addEventListener(EVENTO, alAvisar);
    return () => window.removeEventListener(EVENTO, alAvisar);
  }, []);

  useEffect(() => {
    if (!activo) return;
    const t = window.setInterval(async () => {
      try {
        const r = await fetch(window.location.href, { cache: 'no-store' });
        if (!r.headers.get('x-gcc-mantenimiento')) window.location.reload();
      } catch { /* sigue caído o sin red */ }
    }, 30_000);
    return () => window.clearInterval(t);
  }, [activo]);

  if (!activo) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mantenimiento-titulo"
      className="fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-3.5 p-6 text-center"
      style={{ background: 'var(--mant-fondo, #faf9f8)', color: '#242424', fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif' }}
    >
      <style>{`@media (prefers-color-scheme: dark) { [role=alertdialog][aria-labelledby=mantenimiento-titulo] { --mant-fondo: #1f1f1f; color: #f3f2f1 !important; } [role=alertdialog][aria-labelledby=mantenimiento-titulo] p { color: #c8c6c4 !important; } }`}</style>
      <div aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 16, background: '#4B2D8E' }} />
      <strong id="mantenimiento-titulo">Mantenimiento</strong>
      <p style={{ margin: 0, color: '#605e5c', fontSize: 15, lineHeight: 1.45, maxWidth: 320 }}>
        El servidor está en un mantenimiento repentino. En unos minutos se volverá a activar.
      </p>
    </div>
  );
}
