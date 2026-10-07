/*
 * SERVICE WORKER DE GCC WORLD — mínimo, con UNA excepción: «Borradores».
 *
 * ⚠️ NO CACHEA LA APLICACIÓN, y es a propósito: esta plataforma enseña datos en vivo
 * (facturas, tickets, saldos, conversaciones) y una cifra vieja servida como la de hoy es
 * peor que no funcionar, porque no avisa.
 *
 * Para qué está:
 *  1. Instalabilidad (Android exige un service worker con `fetch`).
 *  2. ⭐ «BORRADORES» SIN CONEXIÓN (Fernando, 2026-10-07): la pantalla `/borradores` se guarda
 *     con sus archivos para poder abrirla sin red. Sus DATOS no van aquí: viven en el
 *     dispositivo (IndexedDB, `lib/borradores/almacen.ts`) y la propia pantalla los enseña
 *     con la fecha de la última sincronización. Si una navegación falla por falta de red,
 *     se lleva a `/borradores` (o a `/offline` si aún no se guardó).
 *
 * Los archivos de `/_next/static/` llevan un hash en el nombre (nunca cambian): servirlos
 * del almacén es seguro. Solo se sirven de ahí los que se guardaron para Borradores; el
 * resto va a la red como siempre.
 *
 * Al cambiar este archivo, subir la versión de CACHE (el navegador instala el nuevo y borra
 * el viejo).
 */

const CACHE = 'gcc-shell-v3';
const OFFLINE = '/offline';
const BORRADORES = '/borradores';

/** Guarda la pantalla de Borradores y todo lo que su HTML pide de `/_next/static/`. */
async function guardarBorradores() {
  const c = await caches.open(CACHE);
  const r = await fetch(BORRADORES, { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) return;
  const html = await r.clone().text();
  const archivos = [...new Set((html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []))];
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
    // Una navegación es dato vivo: con red, siempre lo del servidor; sin red, Borradores.
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        const guardada = await caches.match(BORRADORES);
        if (guardada) {
          // Ya en Borradores: la copia guardada. En cualquier otra pantalla: ir a Borradores.
          return url.pathname.startsWith(BORRADORES) ? guardada : Response.redirect(BORRADORES, 302);
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
