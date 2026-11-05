#!/usr/bin/env node
/**
 * BUSCAR EN TODOS LOS PROYECTOS, para la sesión de Gumdramon. Claude Code 2.1.318 no trae `Grep` ni `Glob`: busca
 * por Bash. Pero un `grep -r` libre lee los `.env` (los permisos de `Read` no lo frenan), y lo que la sesión
 * oye lo puede decir cualquiera. Por eso tiene este comando y no Bash:
 *
 *   node buscar.mjs contenido "patrón" [carpeta]   líneas que coinciden (regex, sin distinguir mayúsculas)
 *   node buscar.mjs archivos "parte del nombre" [carpeta]
 *   node buscar.mjs carpeta [carpeta]              lo que hay dentro
 *
 * Sin shell, solo dentro de las raíces de proyectos y sin llaves ni la carpeta vedada.
 */
import { execFile, spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RAICES = () => (process.env.COPILOTO_RAICES
  ? process.env.COPILOTO_RAICES.split(':')
  : ['Documents/02_Clientes', 'Library/CloudStorage/OneDrive-GCC/02_Clientes', 'corazonescruzados'].map((r) => path.join(os.homedir(), r))
).filter((r) => fs.existsSync(r));

const CARPETAS_FUERA = ['node_modules', '.git', '.next', '.build', 'build', 'dist', 'Pods', 'DerivedData', '.venv', 'venv', '__pycache__', '.ssh', '.aws', '.gnupg', 'certificates', '*peter*tours*', 'generated', '.gradle', 'coverage'];
const ARCHIVOS_FUERA = ['.env*', '*.pem', '*.p12', '*.key', '*.jks', '*.keystore', '*.mobileprovision', '*.lock', 'package-lock.json', '*.min.js', '*.map', '*.tsbuildinfo'];
const POR_CLIENTE = 15;
const POR_ARCHIVO = 3;
const TOPE_LEIDAS = 400; // de cada cliente, antes de elegir
const VEDADO = /(^|\/)(\.env[^/]*|\.ssh|\.aws|\.gnupg|certificates|[^/]*peter[^/]*tours[^/]*)(\/|$)|\.(pem|p12|key|jks|keystore|mobileprovision)$/i;
const SECRETO_EN_LINEA = /((pass(word|wd)?|secret|token|api_?key|private_?key|clave|database_url)\s*[:=]\s*\S|postgres(ql)?:\/\/\S+:\S+@|-----BEGIN)/i;

export function rutaSegura(ruta) {
  if (!ruta) return null;
  const real = path.resolve(String(ruta).replace(/^~(?=\/|$)/, os.homedir()));
  if (VEDADO.test(real)) throw new Error('Esa ruta no se puede consultar.');
  const dentro = RAICES().some((r) => real === r || real.startsWith(r + path.sep));
  if (!dentro) throw new Error(`Solo se busca dentro de: ${RAICES().join(', ')}`);
  return real;
}

const ejecutar = (cmd, args) => new Promise((ok) => {
  // grep sale con 1 si no encuentra y con 2 si alguna carpeta no se puede leer: lo encontrado sigue valiendo.
  execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 }, (_e, out) => ok(out || ''));
});

/**
 * Un `grep` de todos los clientes suelta decenas de megas: con un tope de salida se cortaba en silencio tras los
 * primeros por orden alfabético y parecía que el resto no tenía nada (2026-11-05). Se lee por líneas, sin tope, y
 * se reparte entre clientes, con los documentos primero: un `MEMORIA.md` dice más que cien líneas de código.
 */
export function clienteDe(ruta, raices = RAICES()) {
  const raiz = raices.find((r) => ruta.startsWith(r + path.sep));
  return raiz ? path.relative(raiz, ruta).split(path.sep).slice(0, 2).join('/') : ruta;
}

const esDocumento = (f) => /\.(md|txt)$/i.test(f);

export function repartir(lineas) {
  const porCliente = new Map();
  for (const { archivo, texto } of lineas) {
    const c = clienteDe(archivo);
    if (!porCliente.has(c)) porCliente.set(c, []);
    porCliente.get(c).push({ archivo, texto });
  }
  const salida = [];
  for (const filas of porCliente.values()) {
    const veces = new Map();
    const ordenadas = [...filas.filter((f) => esDocumento(f.archivo)), ...filas.filter((f) => !esDocumento(f.archivo))];
    let n = 0;
    for (const f of ordenadas) {
      const v = veces.get(f.archivo) || 0;
      if (v >= POR_ARCHIVO || n >= POR_CLIENTE) continue;
      veces.set(f.archivo, v + 1);
      n++;
      salida.push(f.texto);
    }
  }
  return salida;
}

const grepPorLineas = (args) => new Promise((ok) => {
  const hijo = spawn('grep', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  const plazo = setTimeout(() => hijo.kill(), 120_000);
  const lineas = [];
  const leidas = new Map();
  readline.createInterface({ input: hijo.stdout }).on('line', (l) => {
    const archivo = l.split(':')[0];
    if (VEDADO.test(archivo) || SECRETO_EN_LINEA.test(l)) return;
    const c = clienteDe(archivo);
    const n = leidas.get(c) || 0;
    if (n >= TOPE_LEIDAS && !esDocumento(archivo)) return;
    leidas.set(c, n + 1);
    lineas.push({ archivo, texto: l.slice(0, 300) });
  });
  hijo.on('close', () => { clearTimeout(plazo); ok(lineas); });
  hijo.on('error', () => { clearTimeout(plazo); ok(lineas); });
});

export async function buscar(accion, patron, carpeta) {
  if (accion === 'carpeta') {
    const dirs = carpeta || patron ? [rutaSegura(carpeta || patron)] : RAICES();
    return dirs.flatMap((d) => fs.readdirSync(d, { withFileTypes: true })
      .filter((e) => !VEDADO.test(path.join(d, e.name)) && e.name !== 'node_modules' && e.name !== '.git')
      .map((e) => path.join(d, e.name) + (e.isDirectory() ? '/' : '')));
  }
  if (!patron) throw new Error('Falta qué buscar.');
  const dirs = carpeta ? [rutaSegura(carpeta)] : RAICES();
  if (accion === 'contenido') {
    return repartir(await grepPorLineas(['-rIinE', ...CARPETAS_FUERA.map((c) => `--exclude-dir=${c}`), ...ARCHIVOS_FUERA.map((a) => `--exclude=${a}`), '--', String(patron), ...dirs]));
  }
  if (accion === 'archivos') {
    const fuera = CARPETAS_FUERA.flatMap((c, i) => (i ? ['-o'] : []).concat(['-iname', c]));
    const salida = await ejecutar('find', [...dirs, '(', ...fuera, ')', '-prune', '-o', '-type', 'f', '-iname', `*${String(patron).replace(/[*?[\]]/g, '')}*`, '-print']);
    return salida.split('\n').filter((l) => l && !VEDADO.test(l)).slice(0, 200);
  }
  throw new Error('Usa: contenido, archivos o carpeta.');
}

if (import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1] || '')).href) {
  const [accion, patron, carpeta] = process.argv.slice(2);
  try {
    const filas = await buscar(accion, patron, carpeta);
    console.log(filas.length ? filas.join('\n') : 'Sin resultados.');
    if (accion === 'contenido' && filas.length) console.log(`(${POR_CLIENTE} líneas como máximo por proyecto: para ver más, busca dentro de su carpeta)`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  }
}
