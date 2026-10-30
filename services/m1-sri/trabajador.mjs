// EL TRABAJADOR DEL SRI EN EL M1 — ver `lib/finance-sri.ts` en la plataforma.
//
// Pregunta cada 30 s a la plataforma si hay un trabajo. Si lo hay, abre Chrome CON VENTANA (el
// reCAPTCHA invisible de la pantalla de recibidos rechaza a un Chrome sin ventana; con la pantalla
// del M1 bloqueada la ventana no se ve), entra al SRI, consulta los meses que le piden y devuelve
// las filas. La clave llega con el trabajo y no se guarda aquí.
//
// Config: ~/.gcc-sri/config.json → { "url": "https://app.grupocc.org", "token": "…" }
import { readFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const DIR = join(homedir(), '.gcc-sri');
const CFG = JSON.parse(readFileSync(join(DIR, 'config.json'), 'utf8'));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTA = `${CFG.url.replace(/\/$/, '')}/api/finance/sri/trabajador`;
const TIPOS = [1, 3]; // 1 factura, 3 nota de crédito
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const l = `${new Date().toISOString()} ${a.join(' ')}`; console.log(l); try { appendFileSync(join(DIR, 'registro.log'), l + '\n'); } catch {} };

/** El resultado cuesta un par de minutos de Chrome: un corte de red al enviarlo no lo tira, se reintenta. */
async function enviar(cuerpo) {
  for (let i = 1; ; i++) {
    try { return await puerta('POST', cuerpo); }
    catch (e) { if (i >= 6 || /^4\d\d/.test(e.message)) throw e; log(`  envío fallido (${e.message}), reintento ${i}`); await espera(10000 * i); }
  }
}

async function puerta(metodo, cuerpo) {
  const r = await fetch(PUERTA, {
    method: metodo,
    headers: { Authorization: `Bearer ${CFG.token}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${d.error || ''}`.trim());
  return d.data;
}

async function entrar(ruc, clave) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false,
    // Con la tapa cerrada nadie ve la ventana: sin estas tres, Chrome la da por oculta y frena
    // sus temporizadores y su pintado, y el captcha invisible puede no terminar.
    args: ['--lang=es-EC', '--disable-blink-features=AutomationControlled', '--window-size=1366,900',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto('https://srienlinea.sri.gob.ec/sri-en-linea/contribuyente/perfil', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#kc-form-login', { timeout: 60000 });
  await page.type('#usuario', ruc);
  await page.type('#password', clave);
  await page.click('#kc-login');
  await espera(12000);
  if (await page.$('#kc-form-login')) {
    const msg = await page.evaluate(() => (document.querySelector('.alert, .kc-feedback-text, #input-error') || {}).innerText || '');
    throw new Error(`El SRI no aceptó la clave${msg ? `: ${msg.trim()}` : ''}`);
  }
  await page.goto('https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=60&idGrupo=58', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await espera(8000);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }),
    page.evaluate(() => [...document.querySelectorAll('#consultaDocumentoForm a')].find((a) => /recibidos/i.test(a.innerText)).click()),
  ]);
  await espera(5000);
  return { browser, page };
}

/** Una consulta (año, mes, tipo). Devuelve las filas o lanza con el mensaje del SRI. */
async function consultar(page, ano, mes, tipo) {
  await page.select('#frmPrincipal\\:ano', String(ano)); await espera(300);
  await page.select('#frmPrincipal\\:mes', String(mes)); await espera(300);
  await page.select('#frmPrincipal\\:dia', '0'); await espera(300);
  await page.select('#frmPrincipal\\:cmbTipoComprobante', String(tipo)); await espera(300);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('comprobantes-electronicos-internet'), { timeout: 60000 }),
    page.click('#frmPrincipal\\:btnBuscar'),
  ]);
  await espera(3000);
  const msg = await page.evaluate(() => [...document.querySelectorAll('.ui-messages, .ui-growl, [id*="messages"]')].map((e) => e.innerText.trim()).filter(Boolean).join(' | '));
  if (/captcha/i.test(msg)) throw new Error(`Captcha: ${msg}`);
  const leer = () => page.$$eval('tbody[id$="_data"] tr', (trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim().replace(/\s+/g, ' '))).filter((c) => c.length > 5));
  let filas = await leer();
  const pag = await page.evaluate(() => (document.querySelector('.ui-paginator-current') || {}).innerText || '');
  const m = pag.match(/of (\d+)|de (\d+)/);
  const paginas = m ? +(m[1] || m[2]) : 1;
  for (let p = 2; p <= paginas; p++) { await page.click('.ui-paginator-next'); await espera(2500); filas = filas.concat(await leer()); }
  // Las columnas se reconocen por su contenido, no por su posición: así sirve igual para
  // facturas y notas de crédito.
  return filas.map((c) => ({
    tipo,
    emisor: c.find((x) => /^\d{13}\s/.test(x)) || '',
    comprobante: c.find((x) => /^(Factura|Nota de Cr)/i.test(x)) || '',
    clave: c.find((x) => /^\d{49}$/.test(x)) || '',
    total: [...c].reverse().find((x) => /^-?\d+([.,]\d+)?$/.test(x)) || '0',
  })).filter((f) => f.clave);
}

async function ejecutar(t) {
  log(`trabajo ${t.id}: ${t.meses.length} meses`);
  const resultados = [];
  let browser;
  try {
    const s = await entrar(t.ruc, t.clave);
    browser = s.browser;
    for (const { year, month } of t.meses) {
      const comprobantes = [];
      let ok = true, mensaje;
      for (const tipo of TIPOS) {
        let hecho = false;
        for (let intento = 1; intento <= 3 && !hecho; intento++) {
          try { comprobantes.push(...(await consultar(s.page, year, month, tipo))); hecho = true; }
          catch (e) { mensaje = e.message; await espera(5000 * intento); }
        }
        if (!hecho) { ok = false; break; }
        await espera(1500);
      }
      resultados.push({ year, month, ok, comprobantes: ok ? comprobantes : [], mensaje: ok ? undefined : mensaje });
      log(`  ${month}/${year}: ${ok ? `${comprobantes.length} comprobantes` : `FALLÓ ${mensaje}`}`);
    }
    const r = await enviar({ id: t.id, meses: resultados });
    log(`trabajo ${t.id}: ${r.estado}, ${r.nuevos} nuevos`);
  } catch (e) {
    log(`trabajo ${t.id}: ERROR ${e.message}`);
    await enviar({ id: t.id, meses: resultados, error: e.message }).catch((e2) => log('no se pudo avisar:', e2.message));
  } finally {
    await browser?.close().catch(() => {});
  }
}

log('trabajador del SRI en marcha');
for (;;) {
  try {
    const t = await puerta('GET');
    if (t) await ejecutar(t);
    else await espera(30000);
  } catch (e) {
    log('sin conexión con la plataforma:', e.message);
    await espera(60000);
  }
}
