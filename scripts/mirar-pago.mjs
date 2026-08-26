/**
 * Mira la página del enlace de pago en un navegador de verdad.
 * Crea un enlace TEMPORAL (1 hora), captura, y lo REVOCA (no lo borra).
 */
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import puppeteer from 'puppeteer';

const ROOT = '/Users/lfgonzalezm0/Documents/02_Clientes/Fernando González/GCC WORLD';
dotenv.config({ path: `${ROOT}/.env.local` });
dotenv.config({ path: `${ROOT}/.env` });

const DEST = process.argv[2];
const BASE = 'http://localhost:3011';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=gcc_world,public' });

// La etapa pendiente real que encontró `npm run pagos:pendientes`.
const { rows: [etapa] } = await pool.query(`
  SELECT e.id, e.name, e.project_id, e.amount
    FROM gcc_world.project_stages e
    JOIN gcc_world.projects p ON p.id = e.project_id
   WHERE e.invoice_id IS NULL AND e.amount > 0
     AND p.status NOT IN ('cancelled','cotizacion','cotizacion_rechazada')
   ORDER BY e.id LIMIT 1`);
if (!etapa) { console.error('sin etapa pendiente'); process.exit(1); }

const token = randomBytes(32).toString('base64url');
const { rows: [link] } = await pool.query(
  `INSERT INTO gcc_world.payment_links (token, source_type, source_id, stage_id, email, expires_at)
   VALUES ($1,'project',$2,$3,'revision@grupocc.org', NOW() + INTERVAL '1 hour') RETURNING id`,
  [token, String(etapa.project_id), etapa.id],
);
console.log(`enlace temporal #${link.id} para «${etapa.name}» ($${etapa.amount})`);

// ⚠️ El `launch` va DENTRO del try: si falla (p. ej. sin Chrome descargado), el `finally`
// tiene que revocar igualmente el enlace temporal. La primera versión lo dejaba fuera y
// una ejecución fallida dejó un enlace de pago vivo en la base.
const medidas = {};
let navegador = null;
try {
  navegador = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  for (const [nombre, ancho, alto] of [['escritorio', 1440, 1000], ['movil', 390, 900]]) {
    const p = await navegador.newPage();
    await p.setViewport({ width: ancho, height: alto });
    const errores = [];
    p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
    await p.goto(`${BASE}/pagar/${token}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));

    // ── Llegar hasta la pasarela, SIN pagar ─────────────────────────────────
    // Pulsar «Continuar al pago» crea el intento y pide a PayPhone que dibuje su Cajita.
    // Ahí se para: pagar de verdad emitiría una factura electrónica al SRI.
    if (process.env.MIRAR_HASTA_CAJITA === '1') {
      const boton = await p.evaluateHandle(() =>
        Array.from(document.querySelectorAll('button')).find(b => /Continuar al pago/.test(b.textContent || '')) || null);
      if (boton && (await boton.jsonValue?.().catch(() => 1)) !== null) {
        await boton.asElement()?.click().catch(() => {});
        // La Cajita llega por CDN y se evalúa como módulo: hay que darle tiempo real.
        await new Promise(r => setTimeout(r, 6000));
      }
    }
    await p.screenshot({ path: `${DEST}/pago-${nombre}.png`, fullPage: true });
    // Y el fondo real de la página: `fullPage` pinta los elementos fijos en su sitio del
    // viewport, así que un pie fijo APARENTA cruzarse con el contenido. Solo esta segunda
    // captura dice si el cruce es de verdad.
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 600));
    await p.screenshot({ path: `${DEST}/pago-${nombre}-fondo.png` });
    medidas[nombre] = await p.evaluate(() => ({
      desbordaHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      alto: document.documentElement.scrollHeight,
      total: document.body.innerText.match(/Total a pagar[\s\S]{0,30}/)?.[0]?.replace(/\s+/g, ' ') || null,
      hayBotonPagar: !!Array.from(document.querySelectorAll('button')).find(b => /Pagar \$/.test(b.textContent || '')),
      camposFacturacion: document.querySelectorAll('input, select').length,
      // ¿PayPhone llegó a dibujar algo dentro de su contenedor?
      cajitaPintada: (document.getElementById('pp-button')?.children.length || 0) > 0,
      cajitaHtml: (document.getElementById('pp-button')?.innerHTML || '').length,
      hayIframePayphone: !!document.querySelector('iframe[src*="payphone"], #pp-button iframe'),
    }));
    medidas[nombre].erroresConsola = errores.length;
    medidas[nombre].errores = errores.slice(0, 3);
    await p.close();
  }
} finally {
  if (navegador) await navegador.close();
  await pool.query(`UPDATE gcc_world.payment_links SET revoked_at = NOW() WHERE id = $1`, [link.id]);
  console.log('enlace temporal REVOCADO (no borrado)');
  await pool.end();
}
console.log(JSON.stringify(medidas, null, 2));
