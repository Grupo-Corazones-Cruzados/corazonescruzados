/**
 * PUBLICAR UNA IDEA (Fernando, 2026-11-10). Un solo formulario (título, descripción, visibilidad y hora)
 * para todas las redes del talento de la idea, sin elegir canales:
 *   · el video a YouTube (Shorts), TikTok, Instagram (Reel) y Facebook (Reel);
 *   · el carrusel a Instagram y LinkedIn; la infografía a LinkedIn.
 * Regla suya: si el talento no tiene conectadas las cinco redes (YouTube, Instagram, Facebook, TikTok y
 * LinkedIn), NO se publica nada. Y solo cuando todo salió bien se borra el proyecto de la Mac (Drive se queda).
 *
 * Hoy solo YouTube tiene publicador: Meta, TikTok y LinkedIn esperan la aprobación de sus apps. Mientras
 * falte uno, la puerta lo dice y no se empieza (publicar a medias dejaría la idea en dos estados).
 */
import fs from 'node:fs';
import { pool } from '@/lib/db';
import { REDES_TALENTO, tokenDeCuenta, marcarReconectar, type RedTalento } from '@/lib/redes/talento';
import { subirAYoutube, CuentaReconectar } from '@/lib/centralized/youtube-subida';
import { limpiarParaYoutube } from '@/lib/centralized/publicar';
import { borrarLocal, leerManifiesto, rutaSegura } from '@/lib/centralized/contenido-local';

export const OBLIGATORIAS: RedTalento[] = ['youtube', 'instagram', 'facebook', 'tiktok', 'linkedin'];
/** Qué pieza va a cada red. */
const PIEZAS: { red: RedTalento; pieza: 'video' | 'carrusel' | 'infografia' }[] = [
  { red: 'youtube', pieza: 'video' }, { red: 'tiktok', pieza: 'video' }, { red: 'instagram', pieza: 'video' }, { red: 'facebook', pieza: 'video' },
  { red: 'instagram', pieza: 'carrusel' }, { red: 'linkedin', pieza: 'carrusel' }, { red: 'linkedin', pieza: 'infografia' },
];
/** Las redes que ya saben publicar. */
const CON_PUBLICADOR = new Set<RedTalento>(['youtube']);

export interface DatosPublicacion { titulo: string; descripcion: string; privacidad: 'private' | 'unlisted' | 'public'; programada: string | null }

let lista = false;
async function asegurar() {
  if (lista) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS gcc_world.gcont_publicaciones_red (
    id BIGSERIAL PRIMARY KEY, video_id INT NOT NULL REFERENCES gcc_world.gcont_videos(id) ON DELETE CASCADE,
    red TEXT NOT NULL, pieza TEXT NOT NULL, cuenta_id BIGINT, estado TEXT NOT NULL DEFAULT 'pendiente', progreso REAL NOT NULL DEFAULT 0,
    url TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  lista = true;
}

/** Qué falta para poder publicar: redes sin conectar y redes que aún no saben publicar. */
export async function puertaPublicar(userId: string, talento: string | null) {
  await asegurar();
  const etiqueta = (r: RedTalento) => REDES_TALENTO.find((x) => x.red === r)!.etiqueta;
  if (!talento) return { lista: false, sinConectar: OBLIGATORIAS.map(etiqueta), sinPublicador: [] as string[], cuentas: {} as Record<string, { id: number; nombre: string }> };
  const { rows } = await pool.query(
    `SELECT id::int, red, nombre FROM gcc_world.redes_talento WHERE user_id = $1 AND talento = $2 AND estado = 'activa'`, [userId, talento]);
  const cuentas = Object.fromEntries(rows.map((r: any) => [r.red, { id: r.id, nombre: r.nombre }]));
  const sinConectar = OBLIGATORIAS.filter((r) => !cuentas[r]).map(etiqueta);
  const sinPublicador = OBLIGATORIAS.filter((r) => !CON_PUBLICADOR.has(r)).map(etiqueta);
  return { lista: !sinConectar.length && !sinPublicador.length, sinConectar, sinPublicador, cuentas };
}

export async function publicacionesDe(videoId: number) {
  await asegurar();
  const { rows } = await pool.query(
    `SELECT id::int, red, pieza, estado, progreso, url, error FROM gcc_world.gcont_publicaciones_red WHERE video_id = $1 ORDER BY id`, [videoId]);
  return rows;
}

/** Arranca y vuelve: la pantalla sigue el avance. Corre en la web local de la Mac. */
export async function publicarIdea(video: { id: number; carpeta: string }, userId: string, talento: string | null, d: DatosPublicacion) {
  const puerta = await puertaPublicar(userId, talento);
  if (puerta.sinConectar.length) throw new Error(`Faltan por conectar: ${puerta.sinConectar.join(', ')}.`);
  if (puerta.sinPublicador.length) throw new Error(`Publicar en ${puerta.sinPublicador.join(', ')} aún no está disponible.`);
  const m = leerManifiesto(video.carpeta);
  if (!m) throw new Error('El agente todavía no ha entregado las piezas.');
  const { rows: enCurso } = await pool.query(`SELECT 1 FROM gcc_world.gcont_publicaciones_red WHERE video_id = $1 AND estado IN ('pendiente', 'subiendo')`, [video.id]);
  if (enCurso.length) throw new Error('Esta idea ya se está publicando.');
  await pool.query(`DELETE FROM gcc_world.gcont_publicaciones_red WHERE video_id = $1 AND estado <> 'publicada'`, [video.id]);
  const { rows: hechas } = await pool.query(`SELECT red, pieza FROM gcc_world.gcont_publicaciones_red WHERE video_id = $1 AND estado = 'publicada'`, [video.id]);
  const faltan = PIEZAS.filter((x) => !hechas.some((h: any) => h.red === x.red && h.pieza === x.pieza));
  const filas: { id: number; red: RedTalento; pieza: string; cuenta: number }[] = [];
  for (const x of faltan) {
    const cuenta = puerta.cuentas[x.red].id;
    const { rows: [f] } = await pool.query(
      `INSERT INTO gcc_world.gcont_publicaciones_red (video_id, red, pieza, cuenta_id) VALUES ($1, $2, $3, $4) RETURNING id::int`, [video.id, x.red, x.pieza, cuenta]);
    filas.push({ id: f.id, red: x.red, pieza: x.pieza, cuenta });
  }
  void (async () => {
    let todo = true;
    for (const f of filas) {
      try {
        await pool.query(`UPDATE gcc_world.gcont_publicaciones_red SET estado = 'subiendo', updated_at = now() WHERE id = $1`, [f.id]);
        const url = await publicarPieza(f, video.carpeta, m, d);
        await pool.query(`UPDATE gcc_world.gcont_publicaciones_red SET estado = 'publicada', progreso = 1, url = $2, updated_at = now() WHERE id = $1`, [f.id, url]);
      } catch (e: any) {
        todo = false;
        if (e instanceof CuentaReconectar) await marcarReconectar(f.cuenta);
        await pool.query(`UPDATE gcc_world.gcont_publicaciones_red SET estado = 'error', error = $2, updated_at = now() WHERE id = $1`, [f.id, String(e?.message || e).slice(0, 500)]);
      }
    }
    if (todo) {
      await pool.query(`UPDATE gcc_world.gcont_videos SET publicado_en = now() WHERE id = $1`, [video.id]);
      try { borrarLocal(video.carpeta); } catch (e: any) { console.error('Borrar proyecto local:', e?.message); }
    }
  })();
}

async function publicarPieza(f: { id: number; red: RedTalento; pieza: string; cuenta: number }, carpeta: string, m: NonNullable<ReturnType<typeof leerManifiesto>>, d: DatosPublicacion): Promise<string> {
  const t = await tokenDeCuenta(f.cuenta);
  if (!t) throw new Error('La cuenta ya no está conectada.');
  if (f.red === 'youtube' && f.pieza === 'video') {
    const ruta = rutaSegura(carpeta, m.video);
    if (!ruta || !fs.existsSync(ruta)) throw new Error('No está el video final.');
    const limpio = limpiarParaYoutube({ titulo: d.titulo, descripcion: d.descripcion, etiquetas: m.etiquetas || [] });
    let ultimo = 0;
    const r = await subirAYoutube(ruta, { ...limpio, privacidad: d.privacidad, programada: d.programada }, t.token.refresh, async (x) => {
      if (x - ultimo < 0.01 && x < 1) return;
      ultimo = x;
      await pool.query(`UPDATE gcc_world.gcont_publicaciones_red SET progreso = $2, updated_at = now() WHERE id = $1`, [f.id, x]);
    });
    return r.url;
  }
  throw new Error(`Publicar en ${f.red} aún no está disponible.`);
}
