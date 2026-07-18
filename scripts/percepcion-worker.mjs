#!/usr/bin/env node
/**
 * Worker LOCAL del Sistema de Percepción Social (Centralizado · colaborador · gestión).
 *
 * Modelo desacoplado: la app web (local o publicada en Railway) solo GUARDA las capturas como
 * 'pendiente'. Este worker corre en una máquina que TIENE el Claude CLI autenticado (p. ej. tu Mac),
 * pregunta a la app por capturas pendientes, baja sus fotos, las analiza con `claude` (tool Read) y
 * devuelve el resultado. Así se puede capturar desde el celular en la web mientras el análisis lo hace
 * este procesador local cuando está encendido.
 *
 * Uso:
 *   node scripts/percepcion-worker.mjs
 *
 * Configuración (env / .env.local):
 *   PERCEPCION_WORKER_TOKEN   (requerido) secreto compartido con el server (mismo valor en ambos).
 *   PERCEPCION_APP_URL        base de la app. Default http://localhost:3002. Para la web: https://<tu-app>.up.railway.app
 *   CLAUDE_CLI_PATH           (opcional) ruta al binario claude. Default $HOME/.local/bin/claude o `claude` en PATH.
 *   PERCEPCION_POLL_MS        (opcional) intervalo de sondeo. Default 5000.
 *   PERCEPCION_BATCH          (opcional) capturas por ciclo. Default 3.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Carga .env.local y .env si dotenv está disponible (no es obligatorio si exportas las env a mano).
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
  dotenv.config();
} catch { /* dotenv opcional */ }

const execFileAsync = promisify(execFile);

const APP_URL = (process.env.PERCEPCION_APP_URL || 'http://localhost:3002').replace(/\/+$/, '');
const TOKEN = process.env.PERCEPCION_WORKER_TOKEN || '';
const POLL_MS = Number(process.env.PERCEPCION_POLL_MS) || 5000;
const BATCH = Number(process.env.PERCEPCION_BATCH) || 3;

function claudeBin() {
  if (process.env.CLAUDE_CLI_PATH) return process.env.CLAUDE_CLI_PATH;
  const home = process.env.HOME || '';
  const cand = home ? `${home}/.local/bin/claude` : '';
  if (cand && existsSync(cand)) return cand;
  return 'claude';
}

const SYSTEM_PROMPT = `Eres un analista de PERCEPCIÓN VISUAL del entorno físico. NO eres un asistente de
programación y NO estás trabajando en ningún repositorio. Tu tarea es OBSERVAR imágenes y describir lo que hay.

Recibes una o varias IMÁGENES (indicadas por su ruta de archivo) que muestran un MISMO entorno real. Usa la
herramienta Read con la ruta de CADA imagen para VERLA. Luego identifica TODOS los elementos presentes en el
conjunto, clasificándolos en una de tres categorías: "objeto", "animal" o "persona".

Para cada elemento entrega TODAS las propiedades que puedas reconocer VISUALMENTE (por ejemplo: color, material,
tamaño aparente, estado/condición, cantidad, posición, y según el caso: especie o raza del animal, color/tipo de
cabello, vestimenta, edad aparente, etc.). Sé exhaustivo pero NO inventes lo que no se ve; si dudas, baja la
confianza. Agrupa objetos idénticos en un solo elemento e indica la cantidad en sus propiedades.

Tu ÚNICA salida es UN objeto JSON en texto plano (sin markdown, sin fences, sin texto adicional) con esta forma:
{"resumen":"descripción breve del entorno en español (1-2 frases)",
 "elementos":[
   {"categoria":"objeto|animal|persona","nombre":"nombre corto en español","confianza":0-100,
    "resumen":"observación breve del elemento en español","propiedades":{"clave":"valor", ...},
    "foto_indices":[1,2]}
 ]}
Reglas: "categoria" DEBE ser exactamente "objeto", "animal" o "persona". "confianza" es un entero 0-100.
"propiedades" es un objeto de pares clave→valor en español (valores como texto). "foto_indices" lista en qué
fotos (numeradas desde 1) aparece el elemento. Si no reconoces ningún elemento, devuelve "elementos":[].`;

function parseJson(raw) {
  const s = (raw || '').trim();
  try { return JSON.parse(s); } catch { /* sigue */ }
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* sigue */ } }
  return {};
}

async function fetchImagen(url) {
  if (url.startsWith('data:')) {
    const m = /^data:image\/(\w+);base64,([\s\S]*)$/.exec(url);
    if (!m) throw new Error('Imagen embebida inválida');
    return { buffer: Buffer.from(m[2], 'base64'), ext: m[1].toLowerCase() };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  const ext = (/(png|jpe?g|webp|gif)/.exec(ct)?.[1] || url.split('.').pop() || 'jpg').replace('jpeg', 'jpg').toLowerCase();
  return { buffer, ext };
}

async function analizar(urls) {
  const dir = mkdtempSync(join(tmpdir(), 'ps-vision-'));
  try {
    const paths = [];
    for (let i = 0; i < urls.length; i++) {
      const { buffer, ext } = await fetchImagen(urls[i]);
      const safeExt = /^(jpg|jpeg|png|webp|gif)$/.test(ext) ? ext : 'jpg';
      const p = join(dir, `foto-${i + 1}.${safeExt}`);
      writeFileSync(p, buffer);
      paths.push(p);
    }
    const lista = paths.map((p, i) => `Foto ${i + 1}: ${p}`).join('\n');
    const input = `Analiza el entorno mostrado en estas ${paths.length} foto(s). Usa la herramienta Read en CADA una de estas rutas para verlas y luego responde SOLO con el objeto JSON de elementos (sin texto adicional):\n${lista}`;
    const args = [
      '-p', input,
      '--output-format', 'json',
      '--permission-mode', 'bypassPermissions',
      '--system-prompt', SYSTEM_PROMPT,
      '--allowedTools', 'Read',
      '--disallowedTools', 'WebSearch', 'WebFetch', 'Bash', 'Write', 'Edit', 'Task', 'Glob', 'Grep',
    ];
    const { stdout } = await execFileAsync(claudeBin(), args, { maxBuffer: 32 * 1024 * 1024, timeout: 280000, cwd: dir });
    const parsed = JSON.parse(stdout);
    if (parsed.is_error) throw new Error(parsed.result || 'Error del Claude CLI');
    const obj = parseJson(parsed.result ?? '');
    const elementos = (Array.isArray(obj?.elementos) ? obj.elementos : [])
      .filter((e) => e && e.nombre != null)
      .map((e) => ({
        categoria: e.categoria,
        nombre: String(e.nombre),
        confianza: e.confianza,
        resumen: e.resumen ?? null,
        propiedades: e.propiedades && typeof e.propiedades === 'object' ? e.propiedades : {},
        foto_indices: Array.isArray(e.foto_indices) ? e.foto_indices : [],
      }));
    return { resumen: String(obj?.resumen || ''), elementos };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}

function log(...a) { console.log(`[percepcion-worker ${new Date().toISOString()}]`, ...a); }

async function apiGet(path) {
  const res = await fetch(`${APP_URL}${path}`, { headers: { 'x-worker-token': TOKEN } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `GET ${path} → ${res.status}`);
  return d;
}
async function apiPost(path, body) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-token': TOKEN },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `POST ${path} → ${res.status}`);
  return d;
}

async function cycle() {
  let capturas = [];
  try {
    ({ capturas } = await apiGet(`/api/centralized/percepcion/worker/pending?limit=${BATCH}`));
  } catch (e) {
    log('No se pudo consultar pendientes:', e.message);
    return;
  }
  if (!capturas.length) return;
  log(`Tomadas ${capturas.length} captura(s):`, capturas.map((c) => c.id).join(', '));
  for (const c of capturas) {
    try {
      if (!c.fotos?.length) throw new Error('La captura no tiene fotos');
      const { resumen, elementos } = await analizar(c.fotos);
      await apiPost('/api/centralized/percepcion/worker/result', { captura_id: c.id, resumen, elementos });
      log(`Captura ${c.id}: ${elementos.length} elemento(s) ✓`);
    } catch (e) {
      log(`Captura ${c.id} FALLÓ:`, e.message);
      try { await apiPost('/api/centralized/percepcion/worker/result', { captura_id: c.id, error: e.message }); }
      catch (e2) { log(`  y no se pudo reportar el error de ${c.id}:`, e2.message); }
    }
  }
}

async function main() {
  if (!TOKEN) {
    console.error('ERROR: falta PERCEPCION_WORKER_TOKEN (defínelo en .env.local o en el entorno).');
    process.exit(1);
  }
  const once = process.argv.includes('--once');
  log(`Worker iniciado${once ? ' (--once)' : ''}. App: ${APP_URL} · claude: ${claudeBin()} · sondeo: ${POLL_MS}ms · lote: ${BATCH}`);
  if (once) { await cycle(); return; }
  // Bucle de sondeo (secuencial: espera a terminar un ciclo antes del siguiente).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await cycle(); } catch (e) { log('Ciclo con error:', e.message); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
