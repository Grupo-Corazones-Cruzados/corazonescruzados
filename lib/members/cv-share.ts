/**
 * CV PÚBLICO COMPARTIBLE — la ÚNICA puerta entre un token y los datos de un miembro.
 *
 * ── POR QUÉ TODO PASA POR AQUÍ ────────────────────────────────────────────────
 * La lección de `lib/flows/acceso.ts` es literal: una regla de acceso copiada en
 * varias rutas es una regla que en alguna de ellas está mal y nadie lo nota. Aquí
 * son cuatro consumidores (la página, el JSON, el PDF y las imágenes) y todos
 * resuelven el token con la misma función.
 *
 * ── LO QUE NO DEBE VERSE NO SALE DEL SERVIDOR ─────────────────────────────────
 * `armarCvPublico()` NO devuelve la fila entera con un `visible: false` al lado
 * para que la pinte quien quiera. Devuelve **solo lo publicable**: si el teléfono
 * está apagado, el teléfono no existe en el objeto. El JSON de una página pública
 * se lee igual de fácil que la página, así que filtrar en el cliente es no filtrar.
 *
 * ── LAS IMÁGENES NO VIAJAN AQUÍ ───────────────────────────────────────────────
 * `member_portfolio_items.images` guarda **base64 dentro de la fila** (PNG de hasta
 * ~2 MB). Mandarlas en el JSON repetiría el fallo que ya costó dos diagnósticos en
 * el marketplace (listas de 4,8 MB / 3,7 s). De cada ítem sale solo `imagenes`, el
 * CONTADOR; los píxeles se piden a `/api/cv/<token>/imagen`, redimensionados.
 */
import crypto from 'crypto';
import { pool } from '@/lib/db';
import { fmtInt } from '@/lib/format';

/* ── Tipos de lo que se publica ─────────────────────────────────────────────── */

export type EstadoLaboral = 'immediate' | 'from_date' | 'not_available';
export type Jornada = 'full' | 'part' | 'both';
export type Modalidad = 'remote' | 'hybrid' | 'onsite' | 'any';

export interface Educacion { institucion: string; titulo: string; campo: string; desde: string; hasta: string }
export interface Experiencia { empresa: string; cargo: string; descripcion: string; desde: string; hasta: string }
export interface TalentoPublico { nombre: string; educacion: Educacion[]; experiencia: Experiencia[]; servicios: string[] }
export interface ItemPortafolio {
  id: number;
  tipo: 'project' | 'product' | 'automation';
  titulo: string;
  descripcion: string | null;
  enlace: string | null;
  etiquetas: string[];
  imagenes: number;
}
export interface FranjaHoraria { dia: number; inicio: string; fin: string }

export interface CvPublico {
  /** Nombre completo tal cual se muestra. */
  nombre: string;
  titular: string | null;
  cargo: string | null;
  ubicacion: string | null;
  foto: string | null;
  bio: string | null;
  /** Solo si el miembro los encendió. Ausentes, no vacíos, cuando están apagados. */
  correo?: string;
  telefono?: string;
  linkedin: string | null;
  web: string | null;
  skills: string[];
  idiomas: string[];
  talentos: TalentoPublico[];
  portafolio: ItemPortafolio[];
  disponibilidad: {
    estado: EstadoLaboral;
    desde: string | null;
    jornada: Jornada;
    modalidad: Modalidad;
    nota: string | null;
    horario: FranjaHoraria[];
  };
  /** Ausente si no la declaró o la tiene oculta. */
  salario?: { min: number | null; max: number | null };
  actualizado: string | null;
}

/* ── Token: generar · consultar · resolver · revocar ────────────────────────── */

/** 32 bytes en hexadecimal. Mismo tamaño y forma que el del calendario público. */
function nuevoToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** `users.member_id` del usuario de la sesión, o `null` si no es miembro. */
export async function memberIdDeUsuario(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT member_id FROM gcc_world.users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.member_id ? String(rows[0].member_id) : null;
}

export async function leerEnlace(memberId: string) {
  const { rows } = await pool.query(
    `SELECT cv_public_token, cv_public_token_created_at
       FROM gcc_world.members WHERE id = $1`,
    [memberId],
  );
  return {
    token: (rows[0]?.cv_public_token as string) || null,
    creado: rows[0]?.cv_public_token_created_at || null,
  };
}

/** Genera o REGENERA. Regenerar invalida el anterior en el acto: es lo que se espera
 *  de un botón «generar de nuevo» cuando el enlace se compartió de más. */
export async function generarEnlace(memberId: string): Promise<string> {
  const token = nuevoToken();
  await pool.query(
    `UPDATE gcc_world.members
        SET cv_public_token = $1, cv_public_token_created_at = NOW()
      WHERE id = $2`,
    [token, memberId],
  );
  return token;
}

export async function revocarEnlace(memberId: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.members
        SET cv_public_token = NULL, cv_public_token_created_at = NULL
      WHERE id = $1`,
    [memberId],
  );
}

/**
 * Token → id de miembro. `null` si el token no existe, fue revocado, regenerado o
 * el miembro está inactivo. Es el ÚNICO sitio donde se traduce un token.
 */
export async function miembroDeToken(token: string): Promise<string | null> {
  // Un token con forma imposible no llega a tocar la base.
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await pool.query(
    `SELECT id FROM gcc_world.members
      WHERE cv_public_token = $1 AND is_active = true`,
    [token],
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

/* ── Ensamblado de lo publicable ────────────────────────────────────────────── */

const texto = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
};
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [];

/** Normaliza una entrada de educación del JSONB `talents`, que se escribió con
 *  claves en inglés desde el editor del CV. */
function aEducacion(e: any): Educacion {
  return {
    institucion: String(e?.institution ?? '').trim(),
    titulo: String(e?.degree ?? '').trim(),
    campo: String(e?.field ?? '').trim(),
    desde: String(e?.start_year ?? '').trim(),
    hasta: String(e?.end_year ?? '').trim(),
  };
}
function aExperiencia(e: any): Experiencia {
  return {
    empresa: String(e?.company ?? '').trim(),
    cargo: String(e?.position ?? '').trim(),
    descripcion: String(e?.description ?? '').trim(),
    desde: String(e?.start_year ?? '').trim(),
    hasta: String(e?.end_year ?? '').trim(),
  };
}
/** Una entrada vacía del editor (se agregó y no se rellenó) no se publica. */
const tieneAlgo = (o: Record<string, string>) => Object.values(o).some((v) => v !== '');

export async function armarCvPublico(memberId: string): Promise<CvPublico | null> {
  const { rows: mRows } = await pool.query(
    `SELECT m.id, m.name, m.email, m.phone, m.photo_url,
            p.name AS position,
            u.avatar_url, u.first_name, u.last_name
       FROM gcc_world.members m
       LEFT JOIN gcc_world.positions p ON p.id = m.position_id
       LEFT JOIN gcc_world.users u     ON u.member_id = m.id
      WHERE m.id = $1 AND m.is_active = true
      LIMIT 1`,
    [memberId],
  );
  const m = mRows[0];
  if (!m) return null;

  const { rows: cvRows } = await pool.query(
    `SELECT bio, skills, languages, linkedin_url, website_url, talents,
            headline, location, salary_min, salary_max, salary_visible,
            job_status, job_available_from, job_workday, job_mode, job_note,
            share_email, share_phone, updated_at
       FROM gcc_world.member_cv_profiles WHERE member_id = $1`,
    [memberId],
  );
  const cv = cvRows[0] || {};

  const { rows: pfRows } = await pool.query(
    `SELECT id, item_type, title, description, project_url, COALESCE(tags, '{}') AS tags,
            COALESCE(array_length(images, 1), CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) AS n_imagenes
       FROM gcc_world.member_portfolio_items
      WHERE member_id = $1
      ORDER BY item_type, sort_order, id`,
    [memberId],
  );

  const { rows: hRows } = await pool.query(
    `SELECT day_of_week, start_time, end_time
       FROM gcc_world.member_schedules
      WHERE member_id = $1 AND is_active = true
      ORDER BY day_of_week`,
    [memberId],
  );

  // Servicios activos, agrupados por talento: son la prueba de qué hace con cada uno.
  const { rows: sRows } = await pool.query(
    `SELECT name, talent FROM gcc_world.services
      WHERE member_id = $1 AND is_active = true
      ORDER BY name`,
    [memberId],
  );
  const serviciosPorTalento = new Map<string, string[]>();
  for (const s of sRows) {
    const k = String(s.talent ?? '');
    if (!serviciosPorTalento.has(k)) serviciosPorTalento.set(k, []);
    serviciosPorTalento.get(k)!.push(String(s.name));
  }

  const talentosCrudos: any[] = Array.isArray(cv.talents) ? cv.talents : [];
  const talentos: TalentoPublico[] = talentosCrudos
    .map((t) => ({
      nombre: String(t?.key ?? '').trim(),
      educacion: (Array.isArray(t?.education) ? t.education : []).map(aEducacion).filter(tieneAlgo as any),
      experiencia: (Array.isArray(t?.experience) ? t.experience : []).map(aExperiencia).filter(tieneAlgo as any),
      servicios: serviciosPorTalento.get(String(t?.key ?? '')) || [],
    }))
    .filter((t) => t.nombre);

  const nombre =
    texto(m.name) ||
    [texto(m.first_name), texto(m.last_name)].filter(Boolean).join(' ') ||
    'Miembro';

  const cvPublico: CvPublico = {
    nombre,
    titular: texto(cv.headline),
    cargo: texto(m.position),
    ubicacion: texto(cv.location),
    // El avatar del panel es el que la persona mantiene al día; la foto del
    // registro de miembro es la de respaldo.
    foto: texto(m.avatar_url) || texto(m.photo_url),
    bio: texto(cv.bio),
    linkedin: texto(cv.linkedin_url),
    web: texto(cv.website_url),
    skills: lista(cv.skills),
    idiomas: lista(cv.languages),
    talentos,
    portafolio: pfRows.map((r: any) => ({
      id: Number(r.id),
      tipo: (r.item_type || 'project') as ItemPortafolio['tipo'],
      titulo: String(r.title ?? ''),
      descripcion: texto(r.description),
      enlace: texto(r.project_url),
      etiquetas: lista(r.tags),
      imagenes: Number(r.n_imagenes) || 0,
      // Nótese: NO va el precio. Es un CV, no una tienda.
    })),
    disponibilidad: {
      estado: (cv.job_status || 'immediate') as EstadoLaboral,
      desde: cv.job_available_from ? new Date(cv.job_available_from).toISOString().slice(0, 10) : null,
      jornada: (cv.job_workday || 'full') as Jornada,
      modalidad: (cv.job_mode || 'any') as Modalidad,
      nota: texto(cv.job_note),
      horario: hRows.map((r: any) => ({
        dia: Number(r.day_of_week),
        inicio: String(r.start_time ?? '').slice(0, 5),
        fin: String(r.end_time ?? '').slice(0, 5),
      })),
    },
    actualizado: cv.updated_at ? new Date(cv.updated_at).toISOString() : null,
  };

  // Contacto: solo si está encendido. Ausente, no vacío.
  if (cv.share_email && texto(m.email)) cvPublico.correo = texto(m.email)!;
  if (cv.share_phone && texto(m.phone)) cvPublico.telefono = texto(m.phone)!;

  // Salario: solo si hay algún extremo y no está oculto.
  const min = cv.salary_min != null ? Number(cv.salary_min) : null;
  const max = cv.salary_max != null ? Number(cv.salary_max) : null;
  if (cv.salary_visible !== false && (min != null || max != null)) {
    cvPublico.salario = { min, max };
  }

  return cvPublico;
}

/**
 * Portadas del portafolio EN CRUDO (data URL o URL remota), solo para el PDF.
 *
 * La página pública nunca las recibe: pide miniaturas al endpoint de imágenes. El
 * PDF sí las necesita en bruto porque se incrusta el binario en el documento, y por
 * eso esta función vive aquí, en la misma puerta, y filtra por `member_id`.
 */
export async function portadasDePortafolio(memberId: string): Promise<{ id: number; imagen: string | null }[]> {
  const { rows } = await pool.query(
    `SELECT id, COALESCE(images[1], image_url) AS imagen
       FROM gcc_world.member_portfolio_items
      WHERE member_id = $1
      ORDER BY item_type, sort_order, id`,
    [memberId],
  );
  return rows.map((r: any) => ({ id: Number(r.id), imagen: r.imagen ? String(r.imagen) : null }));
}

/** Atajo para los cuatro consumidores: token → CV publicable (o `null`). */
export async function cvPublicoDeToken(token: string): Promise<CvPublico | null> {
  const memberId = await miembroDeToken(token);
  if (!memberId) return null;
  return armarCvPublico(memberId);
}

/* ── Etiquetas en español (fuente única: las usan la página y el PDF) ───────── */

export const ETIQUETA_ESTADO: Record<EstadoLaboral, string> = {
  immediate: 'Disponible de inmediato',
  from_date: 'Disponible a partir de',
  not_available: 'No disponible por ahora',
};
export const ETIQUETA_JORNADA: Record<Jornada, string> = {
  full: 'Jornada completa',
  part: 'Media jornada',
  both: 'Jornada completa o parcial',
};
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
  any: 'Remoto, híbrido o presencial',
};
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Rango salarial mensual en USD, ya redactado. Fuente única para la página y el PDF:
 * el mismo número no puede escribirse de dos formas según dónde se lea.
 *
 * El formateo sale de `lib/format` (`fmtInt`, locale es-ES), que es la fuente única
 * de presentación numérica del proyecto. Sin decimales a propósito: es una
 * aspiración aproximada, y «$1.200,00» finge una precisión que nadie tiene.
 */
export function textoSalario(s: { min: number | null; max: number | null }): string {
  if (s.min != null && s.max != null) return `$${fmtInt(s.min)} – $${fmtInt(s.max)}`;
  if (s.min != null) return `Desde $${fmtInt(s.min)}`;
  if (s.max != null) return `Hasta $${fmtInt(s.max)}`;
  return '';
}
