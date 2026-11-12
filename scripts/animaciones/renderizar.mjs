#!/usr/bin/env node
/**
 * Renderiza una animación de Blender del formulario de postulación a `public/animaciones/<id>.webp`
 * (WebP animado con transparencia, se reproduce una vez y se queda en el último cuadro).
 *   node scripts/animaciones/renderizar.mjs <id> [--solo 2.5] [--duracion 6]
 * Usa las piezas de marca de la skill `editar-video` (`blender/gcc.py`, `blender/ejecutar.py`).
 * Con --solo deja un cuadro de muestra en /tmp para revisarlo antes de renderizar todo.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../..');
const ejecutar = join(homedir(), '.claude/skills/editar-video/blender/ejecutar.py');
const a = process.argv.slice(2);
const id = a[0];
const op = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const solo = op('solo');
const duracion = Number(op('duracion', 6));
const [ancho, alto, fps] = [960, 540, 30];

const tmp = op('cuadros') ?? mkdtempSync(join(tmpdir(), `anim-${id}-`));
const args = ['-b', '--factory-startup', '--python-exit-code', '1', '-P', ejecutar, '--',
  '--escena', join(aqui, `${id}.py`), '--salida', tmp, '--motor', 'BLENDER_EEVEE', '--ancho', String(ancho), '--alto', String(alto),
  '--fps', String(fps), '--duracion', String(duracion), '--transparente'];
if (solo) args.push('--solo', solo);
const inicio = Date.now();
// `--cuadros <carpeta>` reutiliza cuadros ya renderizados (solo vuelve a armar el WebP).
const r = op('cuadros') ? { status: 0 } : spawnSync('blender', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error((r.stdout + r.stderr).split('\n').filter((l) => /error|Traceback|File "|line \d/i.test(l)).slice(-20).join('\n')); process.exit(1); }
if (solo) {
  const destino = join(tmpdir(), `${id}-muestra-${solo}.png`);
  renameSync(join(tmp, 'solo.png'), destino);
  rmSync(tmp, { recursive: true, force: true });
  console.log(destino);
  process.exit(0);
}
const salida = join(raiz, 'public/animaciones', `${id}.webp`);
spawnSync('mkdir', ['-p', dirname(salida)]);
// El ffmpeg de Homebrew no trae libwebp: se escalan los cuadros con ffmpeg y los junta `img2webp`.
const chicos = join(tmp, 'chicos');
spawnSync('mkdir', ['-p', chicos]);
const f = spawnSync('ffmpeg', ['-y', '-v', 'error', '-start_number', '1', '-i', join(tmp, 'f_%04d.png'), '-vf', 'scale=720:-1:flags=lanczos', join(chicos, 'c_%04d.png')], { encoding: 'utf8' });
if (f.status !== 0) { console.error(f.stderr); process.exit(1); }
const cuadros = readdirSync(chicos).filter((x) => x.endsWith('.png')).sort().map((x) => join(chicos, x));
const w = spawnSync('img2webp', ['-loop', '1', '-min_size', '-lossy', '-q', '72', '-d', String(Math.round(1000 / fps)), ...cuadros, '-o', salida], { encoding: 'utf8', maxBuffer: 1 << 26 });
if (w.status !== 0) { console.error(w.stderr); process.exit(1); }
rmSync(tmp, { recursive: true, force: true });
console.log(JSON.stringify({ salida, kb: Math.round(statSync(salida).size / 1024), segundos: Math.round((Date.now() - inicio) / 1000) }));
