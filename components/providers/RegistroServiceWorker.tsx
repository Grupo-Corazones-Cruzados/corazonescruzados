'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (`public/sw.js`), que es lo que hace instalable la aplicación.
 *
 * ⚠️ SOLO EN PRODUCCIÓN. En desarrollo un service worker se queda en medio entre el
 * navegador y el servidor y hace perder horas: se edita un archivo, se recarga y se sigue
 * viendo lo de antes. Y si alguna vez se registró en `localhost`, el `unregister` de abajo
 * lo quita — si no, seguiría vivo para siempre en ese navegador.
 */
export default function RegistroServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    // Tras la carga: registrar el service worker no puede competir por el ancho de banda
    // con lo que la persona vino a ver.
    const registrar = () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); };
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }, []);

  return null;
}
