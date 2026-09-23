/*
 * SERVICE WORKER DE GCC WORLD — deliberadamente MÍNIMO.
 *
 * ⚠️ NO CACHEA NADA DE LA APLICACIÓN, y es a propósito.
 *
 * Esta plataforma enseña datos en vivo: facturas, tickets, saldos, conversaciones. Un
 * service worker que sirva una copia guardada puede enseñar **una cifra vieja como si
 * fuera la de hoy**, y eso es peor que no funcionar: no avisa. La caché agresiva se añade
 * cuando haya una pantalla que de verdad la necesite, no «por si acaso».
 *
 * Entonces, ¿para qué está? Para dos cosas concretas:
 *  1. **Instalabilidad**: Android solo ofrece «Instalar aplicación» si hay un service
 *     worker con un manejador de `fetch`. Es el primer escalón del camino a las tiendas.
 *  2. **Una pantalla decente sin red**: si la navegación falla, se responde la página
 *     `/offline` en vez del dinosaurio del navegador.
 *
 * Todo lo demás pasa de largo a la red, exactamente como sin service worker.
 */

const CACHE = 'gcc-shell-v1';
const OFFLINE = '/offline';

self.addEventListener('install', (e) => {
  // Solo la página de «sin conexión». Nada más.
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Solo las navegaciones. Las peticiones de datos y de recursos van a la red tal cual:
  // si no hay red, que fallen como siempre — el código de la página ya sabe qué hacer.
  if (req.mode !== 'navigate') return;
  e.respondWith(
    fetch(req).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())),
  );
});
