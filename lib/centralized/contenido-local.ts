/**
 * LAS PIEZAS DE UNA IDEA EN LA MAC Y EN DRIVE (Fernando, 2026-11-10).
 *
 * El agente deja en la carpeta del video `entregables.json` (lo escribe `entregables.mjs` de la skill
 * `editar-video`): el video final, la miniatura, el carrusel y la infografía. Desde aquí:
 *  · se leen para el panel de la derecha;
 *  · «Subir» las copia al Drive de la empresa (lfgonzalezm0@grupocc.org), en una carpeta por talento e
 *    idea que solo pueden abrir las cuentas @grupocc.org; «Actualizar» sustituye el contenido de los
 *    mismos archivos, así los enlaces no cambian;
 *  · al publicar, la carpeta local se borra (Drive se queda).
 * Solo funciona en la Mac: es donde están los archivos.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { google } from 'googleapis';
import { pool } from '@/lib/db';
import { authDrive } from '@/lib/integrations/google-workspace';
import { carpeta as carpetaEmpresa } from '@/lib/media/drive';

const raiz = () => process.env['ESPACIO_EDICION'] || path.join(os.homedir(), 'Movies/GCC-Edicion');
const DOMINIO = 'grupocc.org';

export interface Manifiesto {
  titulo: string; descripcion: string; etiquetas: string[];
  video: string; miniatura: string; carrusel: string[]; infografia: string;
  textoCarrusel?: string; textoInfografia?: string; generado: string;
}
export interface Pieza { ruta: string; tipo: 'video' | 'miniatura' | 'carrusel' | 'infografia'; nombre: string; tamano: number; modificado: number }
export interface EnDrive { carpeta: { id: string; url: string } | null; archivos: Record<string, { id: string; url: string; subido: number }>; subido_en: string | null }

let lista = false;
export async function asegurarColumnasLocales() {
  if (lista) return;
  await pool.query(`ALTER TABLE gcc_world.gcont_contenidos ADD COLUMN IF NOT EXISTS titulo_fijado BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE gcc_world.gcont_videos ADD COLUMN IF NOT EXISTS drive JSONB`);
  await pool.query(`ALTER TABLE gcc_world.gcont_videos ADD COLUMN IF NOT EXISTS publicado_en TIMESTAMPTZ`);
  lista = true;
}

export const dirDe = (carpeta: string) => {
  if (!/^video-\d+(-[a-z0-9]+)*$/.test(carpeta)) throw new Error('Carpeta inválida');
  return path.join(raiz(), carpeta);
};

/** Una ruta dentro de la carpeta del video, y solo de las que salen en el manifiesto. */
export function rutaSegura(carpeta: string, rel: string): string | null {
  const dir = dirDe(carpeta);
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(dir + path.sep)) return null;
  return abs;
}

export function leerManifiesto(carpeta: string): Manifiesto | null {
  try { return JSON.parse(fs.readFileSync(path.join(dirDe(carpeta), 'entregables.json'), 'utf8')); } catch { return null; }
}

export function piezasDe(carpeta: string, m: Manifiesto | null): Pieza[] {
  if (!m) return [];
  const lista: [string, Pieza['tipo']][] = [
    [m.video, 'video'], [m.miniatura, 'miniatura'], ...m.carrusel.map((c) => [c, 'carrusel'] as [string, Pieza['tipo']]), [m.infografia, 'infografia'],
  ];
  const out: Pieza[] = [];
  for (const [rel, tipo] of lista) {
    if (!rel) continue;
    const abs = rutaSegura(carpeta, rel);
    if (!abs) continue;
    try {
      const st = fs.statSync(abs);
      out.push({ ruta: rel, tipo, nombre: path.basename(rel), tamano: st.size, modificado: st.mtimeMs });
    } catch { /* el agente aún no la generó */ }
  }
  return out;
}

/** La primera vez el agente pone el nombre; si Fernando lo cambió a mano, el suyo manda. */
export async function nombrarSiHaceFalta(contenidoId: number, titulo: string | undefined) {
  if (!titulo?.trim()) return;
  await asegurarColumnasLocales();
  await pool.query(
    `UPDATE gcc_world.gcont_contenidos SET titulo = $2, updated_at = now() WHERE id = $1 AND NOT titulo_fijado AND titulo IS DISTINCT FROM $2`,
    [contenidoId, titulo.trim().slice(0, 200)],
  );
}

export async function driveDe(videoId: number): Promise<EnDrive> {
  await asegurarColumnasLocales();
  const { rows } = await pool.query(`SELECT drive FROM gcc_world.gcont_videos WHERE id = $1`, [videoId]);
  return rows[0]?.drive || { carpeta: null, archivos: {}, subido_en: null };
}

const MIME: Record<string, string> = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg' };

/**
 * Sube (o actualiza) las piezas. Lo que no cambió desde la última subida no se vuelve a mandar.
 * La carpeta se comparte con el dominio: cualquier cuenta @grupocc.org con el enlace, nadie más.
 */
export async function subirADrive(v: { id: number; carpeta: string }, c: { id: number; talento: string | null; titulo: string | null; tema: string }) {
  const m = leerManifiesto(v.carpeta);
  const piezas = piezasDe(v.carpeta, m);
  if (!m || !piezas.length) throw new Error('El agente todavía no ha entregado las piezas.');
  const drive = google.drive({ version: 'v3', auth: authDrive() });
  const previo = await driveDe(v.id);

  let carpetaId = previo.carpeta?.id || null;
  if (!carpetaId) {
    carpetaId = await carpetaEmpresa(['Generación de Contenido', c.talento || 'Sin talento', `${c.id} · ${(c.titulo || m.titulo || c.tema || 'Idea').replace(/[/\\]/g, '-').slice(0, 80)}`]);
    await drive.permissions.create({ fileId: carpetaId, requestBody: { type: 'domain', domain: DOMINIO, role: 'reader', allowFileDiscovery: false } });
  }
  const archivos = { ...previo.archivos };
  for (const p of piezas) {
    const abs = rutaSegura(v.carpeta, p.ruta)!;
    const ya = archivos[p.ruta];
    if (ya && ya.subido >= p.modificado) continue;
    const media = { mimeType: MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', body: fs.createReadStream(abs) };
    if (ya) {
      await drive.files.update({ fileId: ya.id, media, fields: 'id' });
      archivos[p.ruta] = { ...ya, subido: p.modificado };
    } else {
      const { data } = await drive.files.create({ requestBody: { name: p.nombre, parents: [carpetaId] }, media, fields: 'id,webViewLink' });
      archivos[p.ruta] = { id: data.id!, url: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`, subido: p.modificado };
    }
  }
  const enDrive: EnDrive = { carpeta: { id: carpetaId, url: `https://drive.google.com/drive/folders/${carpetaId}` }, archivos, subido_en: new Date().toISOString() };
  await pool.query(`UPDATE gcc_world.gcont_videos SET drive = $2 WHERE id = $1`, [v.id, JSON.stringify(enDrive)]);
  return enDrive;
}

/** ¿Hay algo en la Mac más nuevo que lo subido? Es lo que enciende «Actualizar». */
export function pendientesDeSubir(piezas: Pieza[], d: EnDrive): number {
  return piezas.filter((p) => !d.archivos[p.ruta] || d.archivos[p.ruta].subido < p.modificado).length;
}

/** Tras publicar: el proyecto local se borra. Drive se queda con todo. */
export function borrarLocal(carpeta: string) {
  fs.rmSync(dirDe(carpeta), { recursive: true, force: true });
}
