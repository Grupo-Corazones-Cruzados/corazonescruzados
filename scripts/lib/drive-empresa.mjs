/**
 * Subir al Drive de la empresa desde un SCRIPT (fuera de la app Next), con la cuenta de servicio
 * y la delegación de dominio. Es la versión para scripts de `lib/media/drive.ts` + `guardar()`:
 * mismas carpetas, misma comprobación por md5 y mismo registro en `gcc_world.media_drive`.
 * La usan `migrar-media-drive.mjs` y `migrar-carliza-reservas.mjs`.
 */
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

export const RAIZ = 'GCC World · Archivos de la empresa';
const CARPETA = 'application/vnd.google-apps.folder';
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4' };
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
export const limpiar = (s) => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '').slice(0, 150);

export function crearDrive(root) {
  const k = process.env.GOOGLE_SA_KEY
    ? JSON.parse(process.env.GOOGLE_SA_KEY)
    : JSON.parse(fs.readFileSync(path.resolve(root, process.env.GOOGLE_SA_KEY_PATH || 'data/google-sa.json'), 'utf8'));
  const auth = new google.auth.JWT({ email: k.client_email, key: k.private_key, scopes: ['https://www.googleapis.com/auth/drive'], subject: process.env.GOOGLE_WORKSPACE_ORGANIZER });
  const api = google.drive({ version: 'v3', auth });
  const carpetas = new Map();

  async function carpeta(ruta) {
    const partes = [RAIZ, ...ruta];
    const clave = partes.join('/');
    if (carpetas.has(clave)) return carpetas.get(clave);
    let padre = null;
    for (const nombre of partes) {
      const dentro = padre ? `'${esc(padre)}' in parents` : `'root' in parents`;
      const { data } = await api.files.list({ q: `name = '${esc(nombre)}' and mimeType = '${CARPETA}' and ${dentro} and trashed = false`, fields: 'files(id)', pageSize: 1 });
      padre = data.files?.[0]?.id ?? (await api.files.create({ requestBody: { name: nombre, mimeType: CARPETA, ...(padre ? { parents: [padre] } : {}) }, fields: 'id' })).data.id;
    }
    carpetas.set(clave, padre);
    return padre;
  }

  /** Sube, comprueba md5 y registra en media_drive. Devuelve el fileId. */
  async function subir(q, { datos, mime, base, ruta, modulo, referencia, origen }) {
    const nombre = `${limpiar(base) || 'archivo'}.${EXT[mime] || mime.split('/')[1] || 'bin'}`;
    const md5 = createHash('md5').update(datos).digest('hex');
    const { data } = await api.files.create({
      requestBody: { name: nombre, parents: [await carpeta(ruta)] },
      media: { mimeType: mime, body: Readable.from(datos) },
      fields: 'id,md5Checksum,size',
    });
    if (data.md5Checksum !== md5 || Number(data.size) !== datos.length) {
      await api.files.delete({ fileId: data.id }).catch(() => {});
      throw new Error(`md5 distinto para «${nombre}»`);
    }
    await q(`INSERT INTO gcc_world.media_drive (file_id, nombre, mime, tamano, md5, modulo, referencia, origen) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.id, nombre, mime, datos.length, md5, modulo, String(referencia), origen]);
    return data.id;
  }

  async function aPapelera(q, ids) {
    for (const id of ids) {
      await api.files.update({ fileId: id, requestBody: { trashed: true } }).catch(() => {});
      await q(`UPDATE gcc_world.media_drive SET borrado_en = NOW() WHERE file_id = $1`, [id]);
    }
  }

  return { carpeta, subir, aPapelera };
}
