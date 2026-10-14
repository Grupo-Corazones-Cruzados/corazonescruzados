import { pool } from '@/lib/db';
import * as drive from './drive';

/**
 * Fotos y videos de Proyectos y Productos guardados en el Drive de la empresa.
 *
 * Lo que queda en las filas de siempre (`projects.images`, `"Incident".images`,
 * `destrezas.imagen_url`) es la URL `/api/media/<file_id>`: las pantallas la ponen en un
 * `<img src>` y funciona sin tocarlas. El registro de cada archivo (nombre, tipo, de quién es)
 * va en `gcc_world.media_drive`.
 */

export type Modulo = 'proyecto_foto' | 'proyecto_video' | 'incidencia' | 'destreza' | 'reserva_foto';

const PREFIJO = '/api/media/';
const BASE_PUBLICA = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/$/, '');

export function urlMedia(fileId: string): string {
  return `${PREFIJO}${fileId}`;
}

/** Con dominio, para los productos (otro servicio, otro dominio). */
export function urlMediaAbsoluta(fileId: string): string {
  return `${BASE_PUBLICA}${PREFIJO}${fileId}`;
}

export { fileIdDe } from './ref';
import { fileIdDe } from './ref';

const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};
export function extension(mime: string): string {
  return EXT[mime] ?? (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
}

/** `data:image/png;base64,…` → bytes y tipo. `null` si no es una data URL. */
export function decodificarDataUri(s: string): { datos: Buffer; mime: string } | null {
  const m = String(s).match(/^data:([\w/+.-]+);base64,([\s\S]+)$/);
  return m ? { datos: Buffer.from(m[2], 'base64'), mime: m[1] } : null;
}

/** Quita lo que Drive no acepta bien en un nombre y lo acota. La extensión la pone quien llama. */
export function limpiarNombre(s: string): string {
  // Sin puntos al final: «M.1.4.11.» + «.png» daba «M.1.4.11..png» (2026-10-13).
  return String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '').slice(0, 150);
}

/**
 * Sube a Drive (comprobado por md5), lo registra y devuelve la URL para la fila.
 * `base` es el nombre sin extensión; la extensión sale del tipo.
 */
export async function guardar(o: {
  datos: Buffer; mime: string; base: string; modulo: Modulo; referencia: string | number;
  ruta: string[]; origen?: string;
}): Promise<{ fileId: string; url: string; nombre: string }> {
  const nombre = `${limpiarNombre(o.base) || 'archivo'}.${extension(o.mime)}`;
  const sub = await drive.subir({ datos: o.datos, nombre, mime: o.mime, ruta: o.ruta });
  await pool.query(
    `INSERT INTO gcc_world.media_drive (file_id, nombre, mime, tamano, md5, modulo, referencia, origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sub.id, nombre, o.mime, sub.tamano, sub.md5, o.modulo, String(o.referencia), o.origen ?? 'subida'],
  );
  return { fileId: sub.id, url: urlMedia(sub.id), nombre };
}

export type Registro = {
  file_id: string; nombre: string; mime: string; tamano: number;
  modulo: Modulo; referencia: string; borrado_en: string | null;
};

export async function registro(fileId: string): Promise<Registro | null> {
  const { rows } = await pool.query(
    `SELECT file_id, nombre, mime, tamano, modulo, referencia, borrado_en FROM gcc_world.media_drive WHERE file_id = $1`,
    [fileId],
  );
  return rows[0] ?? null;
}

/** Nombres de varias referencias a la vez, para las galerías. Lo que no es de Drive no aparece. */
export async function nombresDe(refs: string[]): Promise<Record<string, string>> {
  const ids = refs.map(fileIdDe).filter((x): x is string => !!x);
  if (!ids.length) return {};
  const { rows } = await pool.query(
    `SELECT file_id, nombre FROM gcc_world.media_drive WHERE file_id = ANY($1::text[])`, [ids],
  );
  return Object.fromEntries(rows.map((r: { file_id: string; nombre: string }) => [r.file_id, r.nombre]));
}

/**
 * Renombra: PRIMERO en Drive y solo si sale bien, en la base. Si Drive falla no cambia nada
 * en ningún lado. Se edita el nombre base; la extensión se conserva.
 */
export async function renombrar(fileId: string, base: string): Promise<string> {
  const r = await registro(fileId);
  if (!r || r.borrado_en) throw new Error('Archivo no encontrado');
  const limpio = limpiarNombre(base);
  if (!limpio) throw new Error('El nombre no puede quedar vacío');
  const nombre = `${limpio}.${extension(r.mime)}`;
  await drive.renombrar(fileId, nombre);
  await pool.query(
    `UPDATE gcc_world.media_drive SET nombre = $2, actualizado_en = NOW() WHERE file_id = $1`, [fileId, nombre],
  );
  return nombre;
}

/** Quitada de la plataforma → a la papelera de Drive. Lo que no es de Drive se ignora. */
export async function quitar(ref: string | null | undefined): Promise<void> {
  const id = fileIdDe(ref);
  if (!id) return;
  await drive.aPapelera(id);
  await pool.query(`UPDATE gcc_world.media_drive SET borrado_en = NOW() WHERE file_id = $1`, [id]);
}

/**
 * Los bytes de una imagen venga de donde venga (Drive, data URL o URL remota), para quien
 * los necesita en el servidor: el video de un proyecto (ffmpeg) y las tarjetas del
 * marketplace (sharp).
 */
export async function leerBytes(ref: string): Promise<{ datos: Buffer; mime: string } | null> {
  const id = fileIdDe(ref);
  if (id) {
    const r = await registro(id);
    if (!r || r.borrado_en) return null;
    return { datos: await drive.descargar(id), mime: r.mime };
  }
  const dataUri = decodificarDataUri(ref);
  if (dataUri) return dataUri;
  if (/^https?:\/\//i.test(ref)) {
    const res = await fetch(ref, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return { datos: Buffer.from(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'application/octet-stream' };
  }
  return null;
}
