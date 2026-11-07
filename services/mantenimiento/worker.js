/**
 * DELANTE DEL DOMINIO (Worker de Cloudflare) — decide a dónde va cada petición.
 *
 *   DESTINO = "m1" (por defecto): todo va al servidor propio por el túnel.
 *   DESTINO = "railway": se reescribe al servidor de respaldo (RAILWAY_URL), sin tocar el DNS.
 *   MANTENIMIENTO = "1": pantalla de mantenimiento para todo, sin llamar a nadie (mudanza, traspaso).
 *
 * Si el destino no responde (el túnel cae con 530, o 502/503/504), se devuelve la pantalla de
 * mantenimiento a quien navega y un 503 con `Retry-After` a lo demás: WhatsApp, PayPhone y las apps
 * reintentan solos, y ningún mensaje se da por entregado. El encabezado `x-gcc-mantenimiento` lo lee la
 * app abierta para enseñar el aviso.
 */
const CAIDO = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);

export default {
  async fetch(request, env) {
    if (env.MANTENIMIENTO === '1') return mantenimiento(request);
    let destino = request;
    if (env.DESTINO === 'railway' && env.RAILWAY_URL) {
      const u = new URL(request.url);
      const r = new URL(env.RAILWAY_URL);
      u.protocol = r.protocol; u.hostname = r.hostname; u.port = r.port;
      destino = new Request(u, request);
    }
    try {
      const res = await fetch(destino);
      if (CAIDO.has(res.status) && !res.headers.has('x-gcc-respuesta')) return mantenimiento(request);
      return res;
    } catch {
      return mantenimiento(request);
    }
  },
};

export function mantenimiento(request) {
  const base = { 'x-gcc-mantenimiento': '1', 'retry-after': '60', 'cache-control': 'no-store' };
  const quiereHtml = request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html');
  if (!quiereHtml) {
    return new Response(JSON.stringify({ error: 'El servidor está en mantenimiento', mantenimiento: true }), {
      status: 503, headers: { ...base, 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return new Response(PAGINA, { status: 503, headers: { ...base, 'content-type': 'text/html; charset=utf-8' } });
}

// Mismo diseño que la pantalla sin conexión de la app (movil/www/error.html). Se recarga sola.
export const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>GCC World · Mantenimiento</title>
<style>
  :root { --fondo: #faf9f8; --texto: #242424; --suave: #605e5c; --marca: #4B2D8E; }
  @media (prefers-color-scheme: dark) { :root { --fondo: #1f1f1f; --texto: #f3f2f1; --suave: #c8c6c4; } }
  html, body { margin: 0; height: 100%; background: var(--fondo); color: var(--texto);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; }
  main { min-height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px; padding: 24px; box-sizing: border-box; text-align: center; }
  .logo { width: 64px; height: 64px; border-radius: 16px; background: var(--marca); }
  p { margin: 0; color: var(--suave); font-size: 15px; line-height: 1.45; max-width: 320px; }
</style>
</head>
<body>
<main>
  <div class="logo" aria-hidden="true"></div>
  <strong>Mantenimiento</strong>
  <p>El servidor está en un mantenimiento repentino. En unos minutos se volverá a activar.</p>
</main>
<script>
  setInterval(function () {
    fetch(location.href, { cache: 'no-store' }).then(function (r) {
      if (!r.headers.get('x-gcc-mantenimiento')) location.reload();
    }).catch(function () {});
  }, 30000);
</script>
</body>
</html>`;
