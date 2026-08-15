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
import type {
  CvPublico, Educacion, EstadoLaboral, Experiencia, ItemPortafolio, Jornada, Modalidad, TalentoPublico,
} from '@/lib/members/cv-tipos';
import { normalizarRed, ORDEN_REDES, REDES, type Red } from '@/lib/members/redes';

/* ── Tipos y etiquetas: en `cv-tipos.ts`, que es puro y lo comparte el navegador.
 * Se re-exportan para que quien ya importaba de aquí no tenga que cambiar. ─────── */
export * from '@/lib/members/cv-tipos';

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
    `SELECT cv_public_token, cv_public_token_created_at, cv_public_token_expires_at
       FROM gcc_world.members WHERE id = $1`,
    [memberId],
  );
  return {
    token: (rows[0]?.cv_public_token as string) || null,
    creado: rows[0]?.cv_public_token_created_at || null,
    caduca: rows[0]?.cv_public_token_expires_at || null,
  };
}

/**
 * Genera o REGENERA, con vigencia. Regenerar invalida el anterior en el acto: es lo
 * que se espera de un botón «generar de nuevo» cuando el enlace se compartió de más.
 *
 * `horas = 0` (o negativo) significa **sin caducidad**, que es una opción explícita
 * y no un descuido: se elige en el desplegable como cualquier otra.
 */
export async function generarEnlace(memberId: string, horas = 0): Promise<{ token: string; caduca: Date | null }> {
  const token = nuevoToken();
  const { rows } = await pool.query(
    `UPDATE gcc_world.members
        SET cv_public_token = $1,
            cv_public_token_created_at = NOW(),
            cv_public_token_expires_at = CASE WHEN $3::int > 0 THEN NOW() + ($3 || ' hours')::interval END
      WHERE id = $2
      RETURNING cv_public_token_expires_at`,
    [token, memberId, Math.max(0, Math.floor(horas))],
  );
  return { token, caduca: rows[0]?.cv_public_token_expires_at || null };
}

export async function revocarEnlace(memberId: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.members
        SET cv_public_token = NULL, cv_public_token_created_at = NULL,
            cv_public_token_expires_at = NULL
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
  // ⚠️ La caducidad se comprueba AQUÍ, en la única puerta. Ponerla en la página y
  // olvidarla en el PDF dejaría el documento accesible después de expirar.
  const { rows } = await pool.query(
    `SELECT id FROM gcc_world.members
      WHERE cv_public_token = $1
        AND is_active = true
        AND (cv_public_token_expires_at IS NULL OR cv_public_token_expires_at > NOW())`,
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
/**
 * Los enlaces de perfil, ya normalizados y en orden. Vuelve a pasar por
 * `normalizarRed()` **aunque en la base ya deberían estar bien**: hay filas
 * anteriores a la migración 035 y un enlace sin `https://` en un `href` es una ruta
 * relativa — un botón que no lleva a ninguna parte delante de un reclutador.
 * Lo que no se pueda arreglar, no se publica.
 */
function armarRedes(m: any, cv: any): { red: Red; etiqueta: string; url: string }[] {
  const bruto: Record<Red, unknown> = {
    linkedin: cv.linkedin_url,
    web: cv.website_url,
    youtube: m.youtube_handle,
    instagram: m.instagram_handle,
    tiktok: m.tiktok_handle,
    facebook: m.facebook_handle,
  };
  const salida: { red: Red; etiqueta: string; url: string }[] = [];
  for (const red of ORDEN_REDES) {
    const { url } = normalizarRed(red, bruto[red]);
    if (url) salida.push({ red, etiqueta: REDES[red].etiqueta, url });
  }
  return salida;
}

/** Una entrada vacía del editor (se agregó y no se rellenó) no se publica. */
const tieneAlgo = (o: Record<string, string>) => Object.values(o).some((v) => v !== '');

export async function armarCvPublico(memberId: string): Promise<CvPublico | null> {
  const { rows: mRows } = await pool.query(
    `SELECT m.id, m.name, m.email, m.phone, m.photo_url,
            p.name AS position,
            u.avatar_url, u.first_name, u.last_name,
            u.youtube_handle, u.tiktok_handle, u.instagram_handle, u.facebook_handle
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
            headline, location, salary_min, salary_max,
            job_status, job_available_from, job_workday, job_mode, job_note,
            updated_at
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

  /* ── Proyectos de la app en los que el miembro TRABAJÓ ──────────────────────
   * Decisión de Fernando (2026-08-14): **solo los COMPLETADOS**. Los borradores y
   * las cotizaciones quedan fuera: no son trabajo hecho, son propuestas, y
   * publicarlas enseñaría la cartera comercial a un tercero. Los que están en curso
   * tampoco — lo que se ve en el CV, se entregó.
   *
   * «Trabajó en» son DOS cosas y hacen falta las dos: la **puja aceptada** dice que
   * entró al proyecto, y la **asignación de requerimientos** que hizo tareas dentro.
   * Con solo una de las dos se caen proyectos reales.
   *
   * Los talentos de los requerimientos hacen de etiquetas: describen el proyecto con
   * el mismo vocabulario que el resto del CV, sin escribir nada a mano.            */
  const { rows: prRows } = await pool.query(
    `SELECT p.id, p.title, p.description,
            COALESCE(array_length(p.images, 1), 0)::int AS n_imagenes,
            COALESCE((SELECT array_agg(DISTINCT t)
                        FROM gcc_world.project_requirements pr, UNNEST(pr.talents) AS t
                       WHERE pr.project_id = p.id), '{}') AS etiquetas
       FROM gcc_world.projects p
      WHERE p.status = 'completed'
        AND (
          EXISTS (SELECT 1 FROM gcc_world.project_bids b
                   WHERE b.project_id = p.id AND b.member_id = $1 AND b.status = 'accepted')
          OR EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra
                       JOIN gcc_world.project_requirements pr ON pr.id = ra.requirement_id
                      WHERE pr.project_id = p.id AND ra.member_id = $1 AND ra.status = 'accepted')
        )
      ORDER BY p.marketplace_published_at DESC NULLS LAST, p.id DESC`,
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
    redes: armarRedes(m, cv),
    skills: lista(cv.skills),
    idiomas: lista(cv.languages),
    talentos,
    // Primero los proyectos de la app —son el trabajo real y con cliente detrás— y
    // detrás lo que la persona añadió a mano.
    portafolio: [
      ...prRows.map((r: any) => ({
        id: Number(r.id),
        fuente: 'proyecto' as const,
        tipo: 'project' as const,
        titulo: String(r.title ?? ''),
        descripcion: texto(r.description),
        enlace: null,
        etiquetas: lista(r.etiquetas),
        imagenes: Number(r.n_imagenes) || 0,
      })),
      ...pfRows.map((r: any) => ({
        id: Number(r.id),
        fuente: 'propio' as const,
        tipo: (r.item_type || 'project') as ItemPortafolio['tipo'],
        titulo: String(r.title ?? ''),
        descripcion: texto(r.description),
        enlace: texto(r.project_url),
        etiquetas: lista(r.tags),
        imagenes: Number(r.n_imagenes) || 0,
        // Nótese: NO va el precio. Es un CV, no una tienda.
      })),
    ],
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

  // Contacto: va siempre que exista. **El campo vacío ES el interruptor** (Fernando,
  // 2026-08-14): un dato que se rellena y luego se oculta con una casilla aparte son
  // dos formas de decir lo mismo, y la segunda hay que descubrirla.
  if (texto(m.email)) cvPublico.correo = texto(m.email)!;
  if (texto(m.phone)) cvPublico.telefono = texto(m.phone)!;

  // Salario: si se escribió, se enseña; si no, no existe. Misma regla.
  const min = cv.salary_min != null ? Number(cv.salary_min) : null;
  const max = cv.salary_max != null ? Number(cv.salary_max) : null;
  if (min != null || max != null) cvPublico.salario = { min, max };

  return cvPublico;
}

/**
 * Portadas del portafolio EN CRUDO (data URL o URL remota), solo para el PDF.
 *
 * La página pública nunca las recibe: pide miniaturas al endpoint de imágenes. El
 * PDF sí las necesita en bruto porque se incrusta el binario en el documento, y por
 * eso esta función vive aquí, en la misma puerta, y filtra por `member_id`.
 */
export async function portadasDePortafolio(
  memberId: string,
): Promise<{ id: number; fuente: 'propio' | 'proyecto'; imagen: string | null }[]> {
  const cv = await armarCvPublico(memberId);
  if (!cv) return [];
  // Se recorre lo que YA se decidió publicar, en vez de repetir aquí las consultas.
  // Si mañana cambia el criterio de qué proyectos salen, el PDF lo sigue solo.
  const salida: { id: number; fuente: 'propio' | 'proyecto'; imagen: string | null }[] = [];
  for (const item of cv.portafolio) {
    if (!item.imagenes) { salida.push({ id: item.id, fuente: item.fuente, imagen: null }); continue; }
    salida.push({ id: item.id, fuente: item.fuente, imagen: await imagenDePortafolio(memberId, item.fuente, item.id, 0) });
  }
  return salida;
}

/**
 * Una imagen concreta del portafolio, EN CRUDO, comprobando que pertenece al miembro.
 *
 * ⚠️ **El `AND member_id` / la comprobación de participación son el candado.** Si la
 * imagen se sirviera solo por su id, revocar el enlace dejaría las fotos accesibles y
 * con el token de una persona se sacarían las de otra probando números.
 */
export async function imagenDePortafolio(
  memberId: string,
  fuente: 'propio' | 'proyecto',
  id: number,
  i: number,
): Promise<string | null> {
  if (fuente === 'propio') {
    const { rows: [r] } = await pool.query(
      `SELECT COALESCE(images[$3], CASE WHEN $3 = 1 THEN image_url END) AS img
         FROM gcc_world.member_portfolio_items
        WHERE id = $1 AND member_id = $2`,
      [id, memberId, i + 1],
    );
    return r?.img ? String(r.img) : null;
  }
  // De un proyecto: se repite la MISMA condición de publicación que arriba
  // (completado + participación), o el token daría acceso a las imágenes de un
  // proyecto que la página no enseña.
  const { rows: [r] } = await pool.query(
    `SELECT p.images[$3] AS img
       FROM gcc_world.projects p
      WHERE p.id = $1
        AND p.status = 'completed'
        AND (
          EXISTS (SELECT 1 FROM gcc_world.project_bids b
                   WHERE b.project_id = p.id AND b.member_id = $2 AND b.status = 'accepted')
          OR EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra
                       JOIN gcc_world.project_requirements pr ON pr.id = ra.requirement_id
                      WHERE pr.project_id = p.id AND ra.member_id = $2 AND ra.status = 'accepted')
        )`,
    [id, memberId, i + 1],
  );
  return r?.img ? String(r.img) : null;
}

/** Atajo para los cuatro consumidores: token → CV publicable (o `null`). */
export async function cvPublicoDeToken(token: string): Promise<CvPublico | null> {
  const memberId = await miembroDeToken(token);
  if (!memberId) return null;
  return armarCvPublico(memberId);
}
