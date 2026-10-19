/*
 * SERVICE WORKER DE GCC WORLD — mínimo, con UNA excepción: la pantalla «Sin conexión».
 *
 * ⚠️ NO CACHEA LA APLICACIÓN, y es a propósito: esta plataforma enseña datos en vivo
 * (facturas, tickets, saldos, conversaciones) y una cifra vieja servida como la de hoy es
 * peor que no funcionar, porque no avisa.
 *
 * Para qué está:
 *  1. Instalabilidad (Android exige un service worker con `fetch`).
 *  2. ⭐ SIN CONEXIÓN (Fernando, 2026-10-07; desde 2026-10-16 ya no es un módulo «Borradores»
 *     sino el estado «Sin conexión» de Tickets y Proyectos): la pantalla `/sin-conexion` se guarda
 *     con sus archivos para poder abrirla sin red. Sus DATOS no van aquí: viven en el
 *     dispositivo (IndexedDB, `lib/borradores/almacen.ts`) y la propia pantalla los enseña
 *     con la fecha de la última sincronización. Si una navegación falla por falta de red,
 *     se lleva a esa pantalla (o a `/offline` si aún no se guardó).
 *
 * Los archivos de `/_next/static/` llevan un hash en el nombre (nunca cambian): servirlos
 * del almacén es seguro. Solo se sirven de ahí los que se guardaron para esa pantalla; el
 * resto va a la red como siempre.
 *
 * Al cambiar este archivo, subir la versión de CACHE (el navegador instala el nuevo y borra
 * el viejo).
 */

const CACHE = 'gcc-shell-v7';
const OFFLINE = '/offline';
const BORRADORES = '/sin-conexion';

/** Guarda la pantalla sin conexión y todo lo que su HTML pide de `/_next/static/`. */
async function guardarBorradores() {
  const c = await caches.open(CACHE);
  const r = await fetch(BORRADORES, { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) return;
  const html = await r.clone().text();
  // ⚠️ La ruta del archivo de la pantalla lleva PARÉNTESIS (`app/(sin-conexion)/…`): cortar en
  // `)` guardaba un trozo inútil y, sin red, la pantalla salía sin lógica (2026-10-16). Se toma
  // hasta la extensión.
  const archivos = [...new Set((html.match(/\/_next\/static\/[^"'\s\\]+?\.(?:js|css|woff2?|ttf|png|svg|jpe?g|webp|ico)/g) || []))];
  await Promise.all(archivos.map((u) => c.add(u).catch(() => {})));
  await c.put(BORRADORES, r);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add(OFFLINE))
      .then(() => guardarBorradores().catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// La página avisa con conexión (tras cada despliegue cambian los archivos): se vuelve a guardar.
self.addEventListener('message', (e) => {
  if (e.data === 'guardar-borradores') e.waitUntil(guardarBorradores().catch(() => {}));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // `no-store`: sin red, el navegador podía servir el panel de su PROPIA caché HTTP; el panel,
    // sin poder comprobar la sesión, mandaba a /auth y de ahí al panel, en bucle (2026-10-07).
    // Una navegación es dato vivo: con red, siempre lo del servidor; sin red, la pantalla sin conexión.
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        const guardada = await caches.match(BORRADORES);
        if (guardada) {
          // Ya en esa pantalla: la copia guardada. En cualquier otra: llevar a ella.
          if (url.pathname.startsWith(BORRADORES)) return guardada;
          // Desde Proyectos se llega a la lista de proyectos; desde cualquier otro sitio, tickets.
          const de = url.pathname.startsWith('/dashboard/projects') ? '?de=proyectos' : '';
          return Response.redirect(BORRADORES + de, 302);
        }
        return (await caches.match(OFFLINE)) || Response.error();
      }),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});

/*
 * 3. PUSH (2026-10-19): avisos de las reuniones de Mi día (1 h, 30, 15 y 5 min antes) aunque el
 *    panel esté cerrado. Los manda el servidor (`lib/calendar/avisos-push.ts`) con
 *    `{ titulo, cuerpo, url, etiqueta, insistir }`. Al tocarla se abre `url`: el Meet si la
 *    reunión lo tiene, si no Mi día (reutilizando una pestaña del panel si ya hay una).
 */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titulo: e.data ? e.data.text() : 'GCC World' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'GCC World', {
    body: d.cuerpo || '',
    icon: '/icono-192.png',
    badge: '/icono-192.png',
    tag: d.etiqueta || undefined,
    renotify: !!d.etiqueta,
    requireInteraction: !!d.insistir,
    data: { url: d.url || '/dashboard/mi-dia' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || '/dashboard/mi-dia', self.location.origin);
  e.waitUntil((async () => {
    if (destino.origin === self.location.origin) {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const panel = abiertas.find((c) => new URL(c.url).origin === self.location.origin);
      if (panel) { await panel.focus(); return panel.navigate(destino.href).catch(() => {}); }
    }
    return self.clients.openWindow(destino.href);
  })());
});
