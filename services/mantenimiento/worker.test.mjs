// node services/mantenimiento/worker.test.mjs — prueba del Worker sin Cloudflare.
import assert from 'node:assert/strict';
import w from './worker.js';
const llamadas = [];
const conRespuesta = (status, headers = {}) => async (req) => { llamadas.push(req.url); return new Response('ok', { status, headers }); };
const html = { headers: { accept: 'text/html,application/xhtml+xml' } };
const casos = [];
const caso = (n, f) => casos.push([n, f]);

caso('pasa tal cual si el M1 responde', async () => {
  globalThis.fetch = conRespuesta(200); const r = await w.fetch(new Request('https://app.grupocc.org/dashboard', html), {});
  assert.equal(r.status, 200); assert.equal(await r.text(), 'ok');
});
caso('un 404 o 500 propio de la app no es mantenimiento', async () => {
  globalThis.fetch = conRespuesta(500); assert.equal((await w.fetch(new Request('https://app.grupocc.org/x'), {})).status, 500);
  globalThis.fetch = conRespuesta(404); assert.equal((await w.fetch(new Request('https://app.grupocc.org/x'), {})).status, 404);
});
caso('túnel caído (530) → página de mantenimiento a quien navega', async () => {
  globalThis.fetch = conRespuesta(530); const r = await w.fetch(new Request('https://app.grupocc.org/', html), {});
  assert.equal(r.status, 503); assert.equal(r.headers.get('x-gcc-mantenimiento'), '1');
  assert.match(await r.text(), /mantenimiento repentino/);
});
caso('webhook (POST) caído → 503 JSON con Retry-After, para que reintente', async () => {
  globalThis.fetch = conRespuesta(502); const r = await w.fetch(new Request('https://app.grupocc.org/api/webhook', { method: 'POST', body: '{}' }), {});
  assert.equal(r.status, 503); assert.equal(r.headers.get('retry-after'), '60'); assert.equal((await r.json()).mantenimiento, true);
});
caso('error de red → mantenimiento', async () => {
  globalThis.fetch = async () => { throw new Error('sin red'); }; assert.equal((await w.fetch(new Request('https://app.grupocc.org/'), {})).status, 503);
});
caso('un 503 que manda la propia app (x-gcc-respuesta) se respeta', async () => {
  globalThis.fetch = conRespuesta(503, { 'x-gcc-respuesta': '1' }); const r = await w.fetch(new Request('https://app.grupocc.org/'), {});
  assert.equal(r.headers.get('x-gcc-mantenimiento'), null);
});
caso('MANTENIMIENTO=1 no llama a nadie', async () => {
  llamadas.length = 0; globalThis.fetch = conRespuesta(200); const r = await w.fetch(new Request('https://app.grupocc.org/', html), { MANTENIMIENTO: '1' });
  assert.equal(r.status, 503); assert.equal(llamadas.length, 0);
});
caso('DESTINO=railway reescribe el host y conserva ruta, consulta y método', async () => {
  llamadas.length = 0; let metodo; globalThis.fetch = async (req) => { llamadas.push(req.url); metodo = req.method; return new Response('ok'); };
  await w.fetch(new Request('https://app.grupocc.org/api/x?a=1', { method: 'POST', body: 'hola' }), { DESTINO: 'railway', RAILWAY_URL: 'https://corazones.up.railway.app' });
  assert.equal(llamadas[0], 'https://corazones.up.railway.app/api/x?a=1'); assert.equal(metodo, 'POST');
});
let mal = 0;
for (const [n, f] of casos) { try { await f(); console.log('ok   ', n); } catch (e) { mal++; console.log('FALLA', n, e.message); } }
console.log(`${casos.length - mal} ok, ${mal} fallan`); process.exit(mal ? 1 : 0);
