/**
 * EXPERIENCIAS PERSONALES (2026-10-13).
 *
 * Las crea el propio usuario (miembro o candidato) y NO afectan su perfil: no hay
 * tareas, ni plazas, ni puntuación. Cada experiencia tiene EVENTOS (la «categoría» de
 * los archivos: nombre libre, fecha, descripción opcional y uno o varios tipos de
 * beneficio: laboral · mental · social · corporal).
 *
 * Los archivos viven en el Google Drive del usuario y se leen EN VIVO:
 *   GCC World / Experiencias / <experiencia> / <fecha · evento>
 * Lo que el usuario suelte desde la app de Drive en la carpeta de la experiencia aparece
 * aquí «sin evento»; asignarle uno = moverlo a la subcarpeta del evento. No hay tabla de
 * archivos, así que no hay nada que sincronizar ni que se pueda desincronizar.
 *
 * Pertenencia: todo se busca por (id, user_id). Un id ajeno da «no encontrada», igual
 * que uno que no existe. Y un archivo solo se toca si está en una carpeta de ESA
 * experiencia (el token del usuario daría acceso a todo su Drive).
 */
import { pool } from '@/lib/db';
import { tokenDeAcceso, leerConexion, guardarCarpetaRaiz } from '@/lib/integrations/google-oauth';
import {
  asegurarCarpetaExperiencias, crearCarpeta, renombrar, aLaPapelera, listarArchivos,
  carpetaViva, mover, infoArchivo, abrirSubida, cuota, tipoPermitido,
  DriveSinEspacio, type ArchivoDrive,
} from '@/lib/integrations/google-drive';

export const BENEFICIOS = ['laboral', 'mental', 'social', 'corporal'] as const;
export type Beneficio = (typeof BENEFICIOS)[number];

export class NoEncontrada extends Error { status = 404; }
export class Invalido extends Error { status = 400; }

export interface ExperienciaPersonal {
  id: number;
  nombre: string;
  descripcion: string | null;
  eventos: number;
  creadaEn: string;
}
export interface EventoPersonal {
  id: number;
  nombre: string;
  fecha: string; // AAAA-MM-DD
  descripcion: string | null;
  beneficios: Beneficio[];
}
export interface ArchivoPersonal extends ArchivoDrive {
  /** null = suelto en la carpeta de la experiencia («sin evento»). */
  eventoId: number | null;
}

// ── Validación ───────────────────────────────────────────────────────────────

const texto = (v: unknown, campo: string, max: number, obligatorio: boolean): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) { if (obligatorio) throw new Invalido(`${campo} es obligatorio.`); return null; }
  if (s.length > max) throw new Invalido(`${campo} admite como máximo ${max} caracteres.`);
  return s;
};

export function validarExperiencia(b: any): { nombre: string; descripcion: string | null } {
  return { nombre: texto(b?.nombre, 'El nombre', 120, true)!, descripcion: texto(b?.descripcion, 'La descripción', 2000, false) };
}

export function validarEvento(b: any): { nombre: string; fecha: string; descripcion: string | null; beneficios: Beneficio[] } {
  const nombre = texto(b?.nombre, 'El nombre del evento', 120, true)!;
  const fecha = typeof b?.fecha === 'string' ? b.fecha : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
    throw new Invalido('La fecha del evento es obligatoria.');
  }
  const beneficios = Array.isArray(b?.beneficios)
    ? [...new Set(b.beneficios.filter((x: unknown): x is Beneficio => BENEFICIOS.includes(x as Beneficio)))] as Beneficio[]
    : [];
  if (beneficios.length === 0) throw new Invalido('Elige al menos un tipo: laboral, mental, social o corporal.');
  return { nombre, fecha, descripcion: texto(b?.descripcion, 'La descripción', 2000, false), beneficios };
}

/** Nombre de la subcarpeta del evento en Drive: ordena por fecha al verla en Drive. */
const carpetaEvento = (e: { fecha: string; nombre: string }) => `${e.fecha} · ${e.nombre}`;

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function listar(userId: string): Promise<ExperienciaPersonal[]> {
  const { rows } = await pool.query(
    `SELECT e.id, e.nombre, e.descripcion, e.creada_en,
            (SELECT count(*)::int FROM gcc_world.exp_personales_eventos v WHERE v.experiencia_id = e.id) AS eventos
       FROM gcc_world.exp_personales e
      WHERE e.user_id = $1
      ORDER BY e.creada_en DESC`,
    [userId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id), nombre: r.nombre, descripcion: r.descripcion, eventos: r.eventos,
    creadaEn: new Date(r.creada_en).toISOString(),
  }));
}

async function experienciaDe(userId: string, id: number): Promise<{ id: number; nombre: string; descripcion: string | null; folder: string }> {
  const { rows } = await pool.query(
    `SELECT id, nombre, descripcion, drive_folder_id FROM gcc_world.exp_personales WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!rows[0]) throw new NoEncontrada('Experiencia no encontrada.');
  return { id: Number(rows[0].id), nombre: rows[0].nombre, descripcion: rows[0].descripcion, folder: rows[0].drive_folder_id };
}

async function eventosDe(expId: number): Promise<(EventoPersonal & { folder: string })[]> {
  const { rows } = await pool.query(
    `SELECT id, nombre, to_char(fecha, 'YYYY-MM-DD') AS fecha, descripcion, beneficios, drive_folder_id
       FROM gcc_world.exp_personales_eventos WHERE experiencia_id = $1
      ORDER BY fecha DESC, id DESC`,
    [expId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id), nombre: r.nombre, fecha: r.fecha, descripcion: r.descripcion,
    beneficios: r.beneficios, folder: r.drive_folder_id,
  }));
}

export async function detalle(userId: string, id: number) {
  const exp = await experienciaDe(userId, id);
  const eventos = await eventosDe(id);
  const token = await tokenDeAcceso(userId);
  const [viva, archivos] = await Promise.all([
    carpetaViva(token, exp.folder),
    listarArchivos(token, [exp.folder, ...eventos.map((e) => e.folder)]),
  ]);
  const porCarpeta = new Map(eventos.map((e) => [e.folder, e.id]));
  return {
    experiencia: { id: exp.id, nombre: exp.nombre, descripcion: exp.descripcion, driveUrl: `https://drive.google.com/drive/folders/${exp.folder}` },
    eventos: eventos.map(({ folder: _f, ...e }) => e),
    archivos: archivos.map((a): ArchivoPersonal => ({ ...a, eventoId: porCarpeta.get(a.carpetaId) ?? null })),
    /** La carpeta de la experiencia se borró desde Drive. */
    carpetaPerdida: !viva,
  };
}

// ── Escritura ────────────────────────────────────────────────────────────────

export async function crear(userId: string, datos: { nombre: string; descripcion: string | null }): Promise<number> {
  const token = await tokenDeAcceso(userId);
  const conexion = await leerConexion(userId);
  const raiz = await asegurarCarpetaExperiencias(token, conexion?.carpetaRaizId ?? null);
  if (raiz !== conexion?.carpetaRaizId) await guardarCarpetaRaiz(userId, raiz);
  const folder = await crearCarpeta(token, datos.nombre, raiz);
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.exp_personales (user_id, nombre, descripcion, drive_folder_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, datos.nombre, datos.descripcion, folder],
  );
  return Number(rows[0].id);
}

export async function actualizar(userId: string, id: number, datos: { nombre: string; descripcion: string | null }): Promise<void> {
  const exp = await experienciaDe(userId, id);
  if (exp.nombre !== datos.nombre) await renombrar(await tokenDeAcceso(userId), exp.folder, datos.nombre);
  await pool.query(
    `UPDATE gcc_world.exp_personales SET nombre = $3, descripcion = $4, actualizada_en = now() WHERE id = $1 AND user_id = $2`,
    [id, userId, datos.nombre, datos.descripcion],
  );
}

/** Manda la carpeta (con todo lo de dentro) a la papelera de Drive y borra la experiencia. */
export async function eliminar(userId: string, id: number): Promise<void> {
  const exp = await experienciaDe(userId, id);
  await aLaPapelera(await tokenDeAcceso(userId), exp.folder);
  await pool.query(`DELETE FROM gcc_world.exp_personales WHERE id = $1 AND user_id = $2`, [id, userId]);
}

export async function crearEvento(userId: string, expId: number, datos: ReturnType<typeof validarEvento>): Promise<number> {
  const exp = await experienciaDe(userId, expId);
  const folder = await crearCarpeta(await tokenDeAcceso(userId), carpetaEvento(datos), exp.folder);
  const { rows } = await pool.query(
    `INSERT INTO gcc_world.exp_personales_eventos (experiencia_id, nombre, fecha, descripcion, beneficios, drive_folder_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [expId, datos.nombre, datos.fecha, datos.descripcion, datos.beneficios, folder],
  );
  return Number(rows[0].id);
}

async function eventoDe(expId: number, eventoId: number) {
  const ev = (await eventosDe(expId)).find((e) => e.id === eventoId);
  if (!ev) throw new NoEncontrada('Evento no encontrado.');
  return ev;
}

export async function actualizarEvento(userId: string, expId: number, eventoId: number, datos: ReturnType<typeof validarEvento>): Promise<void> {
  await experienciaDe(userId, expId);
  const ev = await eventoDe(expId, eventoId);
  if (carpetaEvento(ev) !== carpetaEvento(datos)) await renombrar(await tokenDeAcceso(userId), ev.folder, carpetaEvento(datos));
  await pool.query(
    `UPDATE gcc_world.exp_personales_eventos SET nombre = $3, fecha = $4, descripcion = $5, beneficios = $6
      WHERE id = $1 AND experiencia_id = $2`,
    [eventoId, expId, datos.nombre, datos.fecha, datos.descripcion, datos.beneficios],
  );
}

/**
 * Borrar un evento NO borra sus archivos: vuelven a la carpeta de la experiencia («sin
 * evento») y la subcarpeta vacía va a la papelera.
 */
export async function eliminarEvento(userId: string, expId: number, eventoId: number): Promise<void> {
  const exp = await experienciaDe(userId, expId);
  const ev = await eventoDe(expId, eventoId);
  const token = await tokenDeAcceso(userId);
  if (await carpetaViva(token, ev.folder)) {
    for (const a of await listarArchivos(token, [ev.folder])) await mover(token, a.id, exp.folder, [ev.folder]);
    await aLaPapelera(token, ev.folder);
  }
  await pool.query(`DELETE FROM gcc_world.exp_personales_eventos WHERE id = $1 AND experiencia_id = $2`, [eventoId, expId]);
}

/** Carpetas de la experiencia → evento (null = la de la experiencia). */
async function carpetas(userId: string, expId: number) {
  const exp = await experienciaDe(userId, expId);
  const eventos = await eventosDe(expId);
  return { exp, eventos, todas: [exp.folder, ...eventos.map((e) => e.folder)] };
}

/** El archivo tiene que estar en una carpeta de ESTA experiencia, o no se toca. */
async function archivoDe(token: string, fileId: string, todas: string[]) {
  const info = await infoArchivo(token, fileId);
  const dentro = info.parents.filter((p) => todas.includes(p));
  if (info.trashed || dentro.length === 0) throw new NoEncontrada('El archivo no pertenece a esta experiencia.');
  return dentro;
}

export async function abrirSubidaArchivo(
  userId: string, expId: number,
  datos: { eventoId: number | null; nombre: string; mime: string; tamano: number; origin: string },
): Promise<string> {
  if (!tipoPermitido(datos.mime)) throw new Invalido('Solo se admiten PDF, imágenes y videos.');
  if (!Number.isFinite(datos.tamano) || datos.tamano <= 0) throw new Invalido('Archivo vacío.');
  const nombre = texto(datos.nombre, 'El nombre del archivo', 255, true)!;
  const { exp, eventos } = await carpetas(userId, expId);
  const carpeta = datos.eventoId == null ? exp.folder : eventos.find((e) => e.id === datos.eventoId)?.folder;
  if (!carpeta) throw new NoEncontrada('Evento no encontrado.');
  const token = await tokenDeAcceso(userId);
  // Avisar ANTES de subir: con un video grande, enterarse al final es perder la espera.
  const c = await cuota(token);
  if (c.libre != null && c.libre < datos.tamano) throw new DriveSinEspacio();
  return abrirSubida(token, { nombre, mime: datos.mime, tamano: datos.tamano, carpeta, origin: datos.origin });
}

export async function asignarArchivo(userId: string, expId: number, fileId: string, eventoId: number | null): Promise<void> {
  const { exp, eventos, todas } = await carpetas(userId, expId);
  const destino = eventoId == null ? exp.folder : eventos.find((e) => e.id === eventoId)?.folder;
  if (!destino) throw new NoEncontrada('Evento no encontrado.');
  const token = await tokenDeAcceso(userId);
  const actuales = await archivoDe(token, fileId, todas);
  await mover(token, fileId, destino, actuales);
}

export async function eliminarArchivo(userId: string, expId: number, fileId: string): Promise<void> {
  const { todas } = await carpetas(userId, expId);
  const token = await tokenDeAcceso(userId);
  await archivoDe(token, fileId, todas);
  await aLaPapelera(token, fileId);
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

/**
 * Traduce un error a respuesta. Los de conexión llevan `code` para que la pantalla
 * ofrezca «Conectar» / «Reconectar» en vez de un mensaje genérico; y NUNCA se responde
 * una lista vacía con 200 cuando algo falló.
 */
export function respuestaDeError(e: any, contexto: string): { status: number; body: { error: string; code?: string } } {
  if (e?.code === 'google_no_conectado' || e?.code === 'google_reconectar') return { status: 409, body: { error: e.message, code: e.code } };
  if (e?.code === 'drive_sin_espacio') return { status: 507, body: { error: e.message, code: e.code } };
  if (e?.code === 'drive_no_encontrado') return { status: 404, body: { error: e.message, code: e.code } };
  if (e instanceof NoEncontrada || e instanceof Invalido) return { status: e.status, body: { error: e.message } };
  console.error(`${contexto}:`, e?.message);
  return { status: 500, body: { error: 'No se pudo completar la acción. Inténtalo de nuevo.' } };
}
