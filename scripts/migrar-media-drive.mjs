#!/usr/bin/env node
/**
 * Muda las fotos y videos de Proyectos y Productos al Drive de la empresa (2026-10-13).
 *
 * Decisión de Fernando: todo lo de Proyectos y Productos vive en el Drive de
 * lfgonzalezm0@grupocc.org («GCC World · Archivos de la empresa», una carpeta por proyecto y
 * por producto) y sale de la base (base64/bytea) y de
 * Cloudinary. Ver Aprendizaje.md (P17, P18) y sql/migrations/073_media_drive.sql.
 *
 *   node scripts/migrar-media-drive.mjs                     → PRUEBA: cuenta y enseña, no escribe nada
 *   node scripts/migrar-media-drive.mjs --ejecutar          → sube, comprueba y cambia las filas
 *   node scripts/migrar-media-drive.mjs --borrar-cloudinary → (después, comprobado en pantalla) borra
 *                                                              de Cloudinary los originales ya mudados
 *
 * Seguridad, en este orden y por cada archivo:
 *   1. se sube a Drive y se compara el md5 que devuelve Drive con el nuestro (si no coincide,
 *      se borra de Drive y esa fila no se toca);
 *   2. se registra en gcc_world.media_drive;
 *   3. la fila se cambia SOLO si sigue igual que al leerla (`WHERE images = $antes`): si alguien
 *      la editó entretanto, se deja como estaba y lo subido va a la papelera.
 * Es idempotente: lo que ya es `/api/media/…` se salta, así que se puede repetir.
 */
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config({ path: path.join(ROOT, '.env') });

const EJECUTAR = process.argv.includes('--ejecutar');
const BORRAR_CLOUDINARY = process.argv.includes('--borrar-cloudinary');
const ORGANIZER = process.env.GOOGLE_WORKSPACE_ORGANIZER;
const BASE_PUBLICA = (process.env.NEXT_PUBLIC_APP_URL_PRODUCCION || 'https://app.grupocc.org').replace(/\/$/, '');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const q = (sql, v) => pool.query(sql, v);

// ── Drive ──────────────────────────────────────────────────────────────────
function claveSA() {
  if (process.env.GOOGLE_SA_KEY) return JSON.parse(process.env.GOOGLE_SA_KEY);
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, process.env.GOOGLE_SA_KEY_PATH || 'data/google-sa.json'), 'utf8'));
}
let drive = null;
function api() {
  if (!drive) {
    const k = claveSA();
    const auth = new google.auth.JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/drive'], subject: ORGANIZER });
    drive = google.drive({ version: 'v3', auth });
  }
  return drive;
}
const CARPETA = 'application/vnd.google-apps.folder';
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const carpetas = new Map();
async function carpeta(ruta) {
  const partes = ['GCC World · Archivos de la empresa', ...ruta];
  const clave = partes.join('/');
  if (carpetas.has(clave)) return carpetas.get(clave);
  let padre = null;
  for (const nombre of partes) {
    const dentro = padre ? `'${esc(padre)}' in parents` : `'root' in parents`;
    const { data } = await api().files.list({ q: `name = '${esc(nombre)}' and mimeType = '${CARPETA}' and ${dentro} and trashed = false`, fields: 'files(id)', pageSize: 1 });
    padre = data.files?.[0]?.id ?? (await api().files.create({ requestBody: { name: nombre, mimeType: CARPETA, ...(padre ? { parents: [padre] } : {}) }, fields: 'id' })).data.id;
  }
  carpetas.set(clave, padre);
  return padre;
}
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4' };
const limpiar = (s) => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);

async function subir({ datos, mime, base, ruta, modulo, referencia, origen }) {
  const nombre = `${limpiar(base) || 'archivo'}.${EXT[mime] || mime.split('/')[1] || 'bin'}`;
  const md5 = createHash('md5').update(datos).digest('hex');
  const { data } = await api().files.create({
    requestBody: { name: nombre, parents: [await carpeta(ruta)] },
    media: { mimeType: mime, body: Readable.from(datos) },
    fields: 'id,md5Checksum,size',
  });
  if (data.md5Checksum !== md5 || Number(data.size) !== datos.length) {
    await api().files.delete({ fileId: data.id }).catch(() => {});
    throw new Error(`md5 distinto para «${nombre}»`);
  }
  await q(`INSERT INTO gcc_world.media_drive (file_id, nombre, mime, tamano, md5, modulo, referencia, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [data.id, nombre, mime, datos.length, md5, modulo, String(referencia), origen]);
  return data.id;
}
async function deshacer(ids) {
  for (const id of ids) {
    await api().files.update({ fileId: id, requestBody: { trashed: true } }).catch(() => {});
    await q(`UPDATE gcc_world.media_drive SET borrado_en = NOW() WHERE file_id = $1`, [id]);
  }
}

// ── Leer lo que hay ────────────────────────────────────────────────────────
const esNuestra = (s) => /\/api\/media\/[A-Za-z0-9_-]{10,}/.test(String(s));
function deDataUri(s) {
  const m = String(s).match(/^data:([\w/+.-]+);base64,([\s\S]+)$/);
  return m ? { datos: Buffer.from(m[2], 'base64'), mime: m[1] } : null;
}
async function bytesDe(ref) {
  const d = deDataUri(ref);
  if (d) return { ...d, origen: 'base64' };
  if (/^https?:\/\//i.test(ref)) {
    const r = await fetch(ref, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`${r.status} al bajar ${ref}`);
    const mime = (r.headers.get('content-type') || '').split(';')[0] || 'image/jpeg';
    return { datos: Buffer.from(await r.arrayBuffer()), mime, origen: /res\.cloudinary\.com/.test(ref) ? `cloudinary:${ref}` : `url:${ref}` };
  }
  return null;
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const resumen = { archivos: 0, bytes: 0, filas: 0, saltadas: 0, errores: 0 };

// ── 1. Fotos de proyectos ──────────────────────────────────────────────────
async function fotosDeProyectos() {
  const { rows } = await q(`SELECT id, title, images FROM gcc_world.projects WHERE images IS NOT NULL AND array_length(images,1) > 0 ORDER BY id`);
  for (const p of rows) {
    const pendientes = p.images.filter((s) => !esNuestra(s));
    if (!pendientes.length) continue;
    console.log(`· Proyecto ${p.id} «${p.title}»: ${pendientes.length} de ${p.images.length} fotos por mudar`);
    if (!EJECUTAR) { resumen.archivos += pendientes.length; resumen.filas++; continue; }
    const subidos = [];
    try {
      const nuevas = [];
      for (let i = 0; i < p.images.length; i++) {
        const ref = p.images[i];
        if (esNuestra(ref)) { nuevas.push(ref); continue; }
        const b = await bytesDe(ref);
        if (!b) { nuevas.push(ref); continue; }
        const id = await subir({ ...b, base: `${p.title || `Proyecto ${p.id}`} · foto ${String(i + 1).padStart(2, '0')}`, ruta: ['Proyectos', `${p.id} · ${p.title || ''}`.trim(), 'Fotos'], modulo: 'proyecto_foto', referencia: p.id });
        subidos.push(id); nuevas.push(`/api/media/${id}`);
        resumen.archivos++; resumen.bytes += b.datos.length;
      }
      const r = await q(`UPDATE gcc_world.projects SET images = $1 WHERE id = $2 AND images = $3`, [nuevas, p.id, p.images]);
      if (r.rowCount !== 1) { await deshacer(subidos); resumen.saltadas++; console.log(`  ↺ cambió mientras tanto: se deja igual`); continue; }
      resumen.filas++;
    } catch (e) { await deshacer(subidos); resumen.errores++; console.error(`  ✖ ${e.message} (no se tocó la fila)`); }
  }
}

// ── 2. Video de proyectos ──────────────────────────────────────────────────
async function videosDeProyectos() {
  const { rows } = await q(`SELECT id, title, octet_length(video_data) AS n FROM gcc_world.projects WHERE video_data IS NOT NULL AND video_file_id IS NULL`);
  for (const p of rows) {
    console.log(`· Proyecto ${p.id} «${p.title}»: video de ${kb(p.n)}`);
    if (!EJECUTAR) { resumen.archivos++; resumen.filas++; continue; }
    let id = null;
    try {
      const { rows: [v] } = await q(`SELECT video_data FROM gcc_world.projects WHERE id = $1`, [p.id]);
      id = await subir({ datos: v.video_data, mime: 'video/mp4', base: `${p.title || `Proyecto ${p.id}`} · video`, ruta: ['Proyectos', `${p.id} · ${p.title || ''}`.trim(), 'Video'], modulo: 'proyecto_video', referencia: p.id, origen: 'bytea' });
      const r = await q(`UPDATE gcc_world.projects SET video_file_id = $1, video_data = NULL WHERE id = $2 AND video_file_id IS NULL AND md5(video_data) = $3`,
        [id, p.id, createHash('md5').update(v.video_data).digest('hex')]);
      if (r.rowCount !== 1) { await deshacer([id]); resumen.saltadas++; console.log('  ↺ cambió mientras tanto'); continue; }
      resumen.archivos++; resumen.bytes += v.video_data.length; resumen.filas++;
    } catch (e) { if (id) await deshacer([id]); resumen.errores++; console.error(`  ✖ ${e.message}`); }
  }
}

// ── 3. Fotos de incidencias (portal de documentación) ───────────────────────
async function fotosDeIncidencias() {
  const { rows } = await q(`SELECT i.id, i.title, i.images, coalesce(p.name, i."projectId") AS proyecto
                              FROM gcc_world."Incident" i LEFT JOIN gcc_world."Project" p ON p.id = i."projectId"
                             WHERE array_length(i.images,1) > 0 ORDER BY i."createdAt"`);
  for (const inc of rows) {
    const pendientes = inc.images.filter((s) => !esNuestra(s));
    if (!pendientes.length) continue;
    console.log(`· Incidencia «${inc.title}» (${inc.proyecto}): ${pendientes.length} fotos`);
    if (!EJECUTAR) { resumen.archivos += pendientes.length; resumen.filas++; continue; }
    const subidos = [];
    try {
      const nuevas = [];
      for (let i = 0; i < inc.images.length; i++) {
        const ref = inc.images[i];
        if (esNuestra(ref)) { nuevas.push(ref); continue; }
        const b = await bytesDe(ref);
        if (!b) { nuevas.push(ref); continue; }
        const id = await subir({ ...b, base: `${inc.title} · foto ${String(i + 1).padStart(2, '0')}`, ruta: ['Documentación de proyectos', inc.proyecto, inc.title.slice(0, 80)], modulo: 'incidencia', referencia: inc.id });
        subidos.push(id); nuevas.push(`/api/media/${id}`);
        resumen.archivos++; resumen.bytes += b.datos.length;
      }
      const r = await q(`UPDATE gcc_world."Incident" SET images = $1 WHERE id = $2 AND images = $3`, [nuevas, inc.id, inc.images]);
      if (r.rowCount !== 1) { await deshacer(subidos); resumen.saltadas++; console.log('  ↺ cambió mientras tanto'); continue; }
      resumen.filas++;
    } catch (e) { await deshacer(subidos); resumen.errores++; console.error(`  ✖ ${e.message}`); }
  }
}

// ── 4. Imágenes de destrezas (producto Planificaciones) ─────────────────────
// Varias filas comparten la MISMA imagen (las destrezas se copian del catálogo), así que se
// sube una vez por contenido distinto y se cambian todas las filas que la llevan.
async function imagenesDeDestrezas() {
  const { rows } = await q(`SELECT d.imagen_url, min(d.codigo) AS codigo, min(coalesce(i.slug, 'catalogo-comun')) AS inquilino, min(d.id) AS id, count(*)::int AS filas
                              FROM planificaciones.destrezas d LEFT JOIN planificaciones.inquilinos i ON i.id = d.inquilino_id
                             WHERE d.imagen_url LIKE 'data:%' GROUP BY d.imagen_url`);
  for (const d of rows) {
    console.log(`· Destreza ${d.codigo} (${d.inquilino}): 1 imagen en ${d.filas} fila(s)`);
    if (!EJECUTAR) { resumen.archivos++; resumen.filas += d.filas; continue; }
    let id = null;
    try {
      const b = deDataUri(d.imagen_url);
      id = await subir({ ...b, base: d.codigo, ruta: ['Productos', 'Planificaciones', d.inquilino, 'Destrezas'], modulo: 'destreza', referencia: d.id, origen: 'base64' });
      const r = await q(`UPDATE planificaciones.destrezas SET imagen_url = $1 WHERE imagen_url = $2`, [`${BASE_PUBLICA}/api/media/${id}`, d.imagen_url]);
      if (r.rowCount === 0) { await deshacer([id]); resumen.saltadas++; continue; }
      resumen.archivos++; resumen.bytes += b.datos.length; resumen.filas += r.rowCount;
    } catch (e) { if (id) await deshacer([id]); resumen.errores++; console.error(`  ✖ ${e.message}`); }
  }
}

// ── 5. Borrar de Cloudinary lo ya mudado (paso aparte) ─────────────────────
async function borrarDeCloudinary() {
  const { v2: cloudinary } = await import('cloudinary');
  const { rows } = await q(`SELECT origen FROM gcc_world.media_drive WHERE origen LIKE 'cloudinary:%' AND borrado_en IS NULL`);
  let n = 0;
  for (const r of rows) {
    const url = r.origen.slice('cloudinary:'.length);
    // …/upload/v123/carpeta/sub/nombre.png → carpeta/sub/nombre
    const m = url.match(/\/upload\/(?:[^/]+\/)*?v\d+\/(.+)\.[a-z0-9]+$/i) || url.match(/\/upload\/(.+)\.[a-z0-9]+$/i);
    if (!m) { console.error('  ? no entiendo', url); continue; }
    // Seguridad: solo si ninguna fila sigue apuntando a esa URL.
    const { rows: [u] } = await q(`SELECT count(*)::int n FROM gcc_world.projects WHERE $1 = ANY(images)`, [url]);
    if (u.n > 0) { console.log('  · sigue en uso, no se borra:', m[1]); continue; }
    const res = await cloudinary.uploader.destroy(m[1]);
    console.log(`  ${res.result === 'ok' ? '✔' : '·'} ${m[1]} → ${res.result}`); if (res.result === 'ok') n++;
  }
  console.log(`Borradas de Cloudinary: ${n} de ${rows.length}`);
}

try {
  if (BORRAR_CLOUDINARY) { await borrarDeCloudinary(); }
  else {
    console.log(EJECUTAR ? '▶ EJECUTANDO la mudanza a Drive' : '▶ PRUEBA (no se escribe nada; usa --ejecutar)');
    await fotosDeProyectos();
    await videosDeProyectos();
    await fotosDeIncidencias();
    await imagenesDeDestrezas();
    console.log(`\n${EJECUTAR ? 'Hecho' : 'Se mudarían'}: ${resumen.archivos} archivos${EJECUTAR ? ` (${kb(resumen.bytes)})` : ''} · ${resumen.filas} filas · ${resumen.saltadas} saltadas · ${resumen.errores} errores`);
  }
} finally {
  await pool.end();
}
