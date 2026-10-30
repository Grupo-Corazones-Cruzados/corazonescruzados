/**
 * Avisa a Bing (y a los demás buscadores de IndexNow: Yandex, Seznam, Naver…) de que unas
 * páginas cambiaron. Bing alimenta a Copilot y a la búsqueda de ChatGPT. No hace falta cuenta:
 * la propiedad se demuestra con la clave publicada en `public/<clave>.txt` (2026-10-30).
 *
 *   node scripts/indexnow.mjs                   → las del mapa del sitio publicado
 *   node scripts/indexnow.mjs /ruta /otra-ruta  → solo esas
 *
 * Google NO usa IndexNow: allí sigue siendo Search Console.
 */
const HOST = 'www.grupocc.org';
const CLAVE = 'e73bb941edf797f832a6927118ff8c21';

const rutas = process.argv.slice(2);
let urls;
if (rutas.length) {
  urls = rutas.map((r) => `https://${HOST}${r.startsWith('/') ? r : `/${r}`}`);
} else {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: CLAVE, keyLocation: `https://${HOST}/${CLAVE}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${r.status} ${r.statusText} — ${urls.length} URL(s)`);
if (!r.ok) console.log(await r.text());
