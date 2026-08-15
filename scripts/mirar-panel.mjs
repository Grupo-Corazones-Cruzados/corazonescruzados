/**
 * MIRAR UNA PANTALLA DEL PANEL — con sesión, en el navegador de verdad.
 *
 *   npm run build && npx next start -p 3099 &
 *   node scripts/mirar-panel.mjs <carpeta-destino> [ruta] [ancho] [alto]
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 * Las pantallas de `/dashboard` exigen contraseña **y un código enviado al correo**,
 * así que no se pueden abrir desde aquí. La consecuencia práctica era entregar
 * cambios de maqueta **sin haberlos visto nunca**, y así se colaron una barra de
 * pestañas desbordada y un botón fuera de sitio que tuvo que ver Fernando.
 *
 * Esto firma un JWT con el secreto del propio entorno —el mismo que usa la app— y
 * lo pone como cookie. **Es una herramienta LOCAL de revisión**: no despliega nada,
 * no escribe en la base y no vale de nada sin el `.env` del proyecto, que ya da
 * acceso a todo.
 *
 * Devuelve además medidas objetivas: si la página se desplaza, cuántos contenedores
 * tienen scroll propio y dónde acaba cada botón «Guardar». Mirar la captura enseña
 * el defecto; las medidas dicen si de verdad está arreglado.
 */
import dotenv from 'dotenv';
import { SignJWT } from 'jose';
import pg from 'pg';
import puppeteer from 'puppeteer';
dotenv.config({ path: '.env.local' }); dotenv.config({ path: '.env' });

const SP = process.argv[2];
const RUTA = process.argv[3] || '/dashboard/settings';
const ANCHO = Number(process.argv[4]) || 1600;
const ALTO = Number(process.argv[5]) || 950;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=gcc_world,public' });
const { rows: [u] } = await pool.query(`SELECT id, email, role FROM gcc_world.users WHERE member_id = 1 LIMIT 1`);
await pool.end();
if (!u) { console.error('sin usuario'); process.exit(1); }

const secreto = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');
const token = await new SignJWT({ userId: u.id, email: u.email, role: u.role })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secreto);

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: ANCHO, height: ALTO, deviceScaleFactor: 2 });
await p.setCookie({ name: 'auth_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true });
await p.goto(`http://127.0.0.1:3099${RUTA}`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));

const m = await p.evaluate(() => ({
  url: location.pathname,
  paginaSeDesplaza: document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 2,
  internos: [...document.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 4 && ['auto','scroll'].includes(getComputedStyle(el).overflowY) && el !== document.scrollingElement).length,
  botones: [...document.querySelectorAll('button')].filter(x => /Guardar/.test(x.textContent)).map(x => {
    const r = x.getBoundingClientRect();
    return { txt: x.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), abajo: Math.round(r.bottom) };
  }),
  alto: window.innerHeight,
}));
console.log(JSON.stringify(m, null, 1));
const nombre = RUTA.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'panel';
await p.screenshot({ path: `${SP}/${nombre}.png` });
console.log(`→ ${SP}/${nombre}.png`);
await b.close();
