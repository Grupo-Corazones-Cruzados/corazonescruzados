import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pool } from '@/lib/db';
import { cifrar, descifrar } from '@/lib/cifrado';
import { ensureGeneracionContenidoTables } from '@/lib/centralized/generacion-contenido-db';
import { CuentaReconectar, subirAYoutube, type DatosVideo } from '@/lib/centralized/youtube-subida';

/** PUBLICAR EN REDES. Solo en la Mac, como el resto del sistema, porque el archivo está en su disco. */
const raiz = () => process.env['ESPACIO_EDICION'] || path.join(os.homedir(), 'Movies/GCC-Edicion');
const contexto = (red: string, externo: string) => `gcont_redes:${red}:${externo}`;
/** Una subida viva avanza cada pocos segundos: si lleva tanto quieta, la web se reinició y ya no sigue. */
const SIN_AVANCE_MS = 5 * 60_000;

let lista = false;
async function asegurar() {
  if (lista) return;
  await ensureGeneracionContenidoTables();
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gcont_redes_cuentas (
    id SERIAL PRIMARY KEY, red TEXT NOT NULL, externo_id TEXT NOT NULL, nombre TEXT NOT NULL, token_cifrado TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activa', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (red, externo_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gcont_publicaciones (
    id SERIAL PRIMARY KEY, video_id INT NOT NULL REFERENCES gcc_world.gcont_videos(id) ON DELETE CASCADE,
    cuenta_id INT NOT NULL REFERENCES gcc_world.gcont_redes_cuentas(id), titulo TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT '',
    privacidad TEXT NOT NULL, programada TIMESTAMPTZ, estado TEXT NOT NULL DEFAULT 'subiendo', progreso REAL NOT NULL DEFAULT 0,
    url TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await pool.query(`CREATE INDEX IF NOT EXISTS gcont_publicaciones_video_idx ON gcc_world.gcont_publicaciones(video_id)`);
  lista = true;
}

export async function guardarCuenta(red: string, externo: string, nombre: string, refresh: string) {
  await asegurar();
  await pool.query(
    `INSERT INTO gcc_world.gcont_redes_cuentas (red, externo_id, nombre, token_cifrado) VALUES ($1, $2, $3, $4)
     ON CONFLICT (red, externo_id) DO UPDATE SET nombre = EXCLUDED.nombre, token_cifrado = EXCLUDED.token_cifrado, estado = 'activa'`,
    [red, externo, nombre, cifrar(refresh, contexto(red, externo))],
  );
}

export async function listarCuentas() {
  await asegurar();
  const { rows } = await pool.query(`SELECT id, red, externo_id, nombre, estado FROM gcc_world.gcont_redes_cuentas ORDER BY nombre`);
  return rows;
}

export function archivoFinal(carpeta: string): { ruta: string; nombre: string; tamano: number } | null {
  const dir = path.join(raiz(), carpeta);
  let entradas: string[] = [];
  try { entradas = fs.readdirSync(dir); } catch { return null; }
  const f = entradas.find((n) => /^final\.\w+$/.test(n));
  if (!f) return null;
  const ruta = path.join(dir, f);
  return { ruta, nombre: f, tamano: fs.statSync(ruta).size };
}

export async function listarPublicaciones(videoId: number) {
  await asegurar();
  await pool.query(
    `UPDATE gcc_world.gcont_publicaciones SET estado = 'error', error = 'La subida se interrumpió. Vuelve a publicar.', updated_at = now()
      WHERE video_id = $1 AND estado = 'subiendo' AND updated_at < now() - make_interval(secs => $2)`,
    [videoId, SIN_AVANCE_MS / 1000],
  );
  const { rows } = await pool.query(
    `SELECT p.id, p.titulo, p.privacidad, p.programada, p.estado, p.progreso, p.url, p.error, p.created_at, c.nombre AS cuenta, c.red
       FROM gcc_world.gcont_publicaciones p JOIN gcc_world.gcont_redes_cuentas c ON c.id = p.cuenta_id
      WHERE p.video_id = $1 ORDER BY p.created_at DESC`,
    [videoId],
  );
  return rows;
}

/** Texto inicial del formulario. Los créditos CC BY entran solos, para que no dependa de acordarse. */
export function creditosObligatorios(carpeta: string): string[] {
  let t = '';
  try { t = fs.readFileSync(path.join(raiz(), carpeta, 'CREDITOS.md'), 'utf8'); } catch { return []; }
  return t.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(' · ')).filter((p) => /^by\b/i.test((p[1] || '').trim())).map((p) => (p[2] || '').trim()).filter(Boolean);
}

/** YouTube rechaza un título de más de 100 caracteres y los signos < y > en título o descripción. */
export function limpiarParaYoutube(d: { titulo: string; descripcion: string; etiquetas: string[] }) {
  const quitar = (s: string) => s.replace(/[<>]/g, '').trim();
  let suma = 0;
  const etiquetas = d.etiquetas.map(quitar).filter(Boolean).filter((e) => { suma += e.length + 2; return suma <= 480; });
  return { titulo: quitar(d.titulo).slice(0, 100), descripcion: Array.from(quitar(d.descripcion)).slice(0, 4900).join(''), etiquetas };
}

/**
 * Arranca la subida y vuelve al momento: la pantalla consulta el avance. Corre dentro de la web local,
 * así que reiniciarla la corta; lo detecta `listarPublicaciones` y se publica de nuevo.
 */
export async function publicarVideo(video: { id: number; carpeta: string }, cuentaId: number, d: DatosVideo) {
  await asegurar();
  const final = archivoFinal(video.carpeta);
  if (!final) throw new Error('Falta subir la versión final del video.');
  const { rows: [c] } = await pool.query(`SELECT id, red, externo_id, token_cifrado, estado FROM gcc_world.gcont_redes_cuentas WHERE id = $1`, [cuentaId]);
  if (!c) throw new Error('Esa cuenta ya no está conectada.');
  const { rows: activas } = await pool.query(`SELECT 1 FROM gcc_world.gcont_publicaciones WHERE video_id = $1 AND cuenta_id = $2 AND estado = 'subiendo' AND updated_at > now() - make_interval(secs => $3)`, [video.id, cuentaId, SIN_AVANCE_MS / 1000]);
  if (activas.length) throw new Error('Este video ya se está subiendo a esa cuenta.');
  const limpio = limpiarParaYoutube(d);
  if (!limpio.titulo) throw new Error('Falta el título.');
  const { rows: [p] } = await pool.query(
    `INSERT INTO gcc_world.gcont_publicaciones (video_id, cuenta_id, titulo, descripcion, privacidad, programada) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [video.id, cuentaId, limpio.titulo, limpio.descripcion, d.programada ? 'private' : d.privacidad, d.programada],
  );
  const refresh = descifrar(c.token_cifrado, contexto(c.red, c.externo_id));
  let ultimo = 0;
  subirAYoutube(final.ruta, { ...d, ...limpio }, refresh, async (f) => {
    if (f - ultimo < 0.01 && f < 1) return;
    ultimo = f;
    await pool.query(`UPDATE gcc_world.gcont_publicaciones SET progreso = $2, updated_at = now() WHERE id = $1`, [p.id, f]);
  })
    .then((r) => pool.query(`UPDATE gcc_world.gcont_publicaciones SET estado = 'publicada', progreso = 1, url = $2, updated_at = now() WHERE id = $1`, [p.id, r.url]))
    .catch(async (e) => {
      if (e instanceof CuentaReconectar) await pool.query(`UPDATE gcc_world.gcont_redes_cuentas SET estado = 'reconectar' WHERE id = $1`, [cuentaId]);
      await pool.query(`UPDATE gcc_world.gcont_publicaciones SET estado = 'error', error = $2, updated_at = now() WHERE id = $1`, [p.id, String(e?.message || e).slice(0, 500)]);
    });
  return p.id as number;
}
