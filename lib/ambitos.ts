/**
 * ÁMBITOS — acceso a datos, definición única.
 *
 * Un **ámbito** es un tipo de proyecto que el grupo sabe manejar (Tecnología, …). Dentro
 * lleva **talentos** del catálogo de la organización (`lib/centralized/talentos.ts`), y son
 * esos talentos los que enganchan con el trabajo hecho:
 *
 *     ámbito ──▶ talentos ──▶ proyectos  (por `project_requirements.talents`)
 *                        └──▶ tickets    (por `tickets.required_talents`)
 *
 * **Ese enganche no se guarda en ninguna parte: se consulta.** Es la misma regla que fijó
 * la migración 037 para el CV público —«un proyecto pertenece a un talento si alguno de sus
 * requerimientos pide ese talento»— y evita el clásico dato duplicado que un día deja de
 * cuadrar.
 *
 * Lo consumen dos sitios, como las FAQs:
 *  · **Admin → Ámbitos**, por la API (`/api/admin/ambitos`).
 *  · **La web pública** (`/ambitos`), que leerá esta capa **directamente en el servidor** al
 *    generar la página. Sería absurdo que la aplicación se llamara a sí misma por HTTP para
 *    leer su propia base.
 *
 * Tabla: `gcc_world.ambitos` + `gcc_world.ambito_talentos` (migración 039).
 */

import { pool } from '@/lib/db';
import { TALENTOS_SET } from '@/lib/centralized/talentos';

export interface Ambito {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  /** Los talentos asociados, en su orden. */
  talentos: string[];
}

/**
 * Cuánto trabajo TERMINADO respalda a un talento.
 *
 * Se enseña en el admin para que, al montar un ámbito, se vea de inmediato si va a salir
 * vacío en la web. Un ámbito con talentos sin nada detrás es una carpeta que el visitante
 * abre para no encontrar nada.
 */
export interface CoberturaTalento {
  talento: string;
  proyectos: number;
  tickets: number;
}

/**
 * ⚠️ SOLO SE PUBLICA LO TERMINADO (decisión de Fernando, 2026-08-18).
 *
 * En la base hay proyectos en `draft`, `cotizacion`, `open`, `review` e `in_progress`. Nada
 * de eso es trabajo hecho, y anunciar en la web lo que aún no existe es exactamente lo que
 * ya tumbó una verificación de Meta. El estado terminado se llama `completed` en las dos
 * tablas — comprobado contra la base de producción, no supuesto.
 */
export const ESTADO_PUBLICABLE = 'completed';

/** Convierte «Automatización de Procesos» en «automatizacion-de-procesos». */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fuera las tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Todos los ámbitos con sus talentos, en orden. */
export async function listarAmbitos(): Promise<Ambito[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.nombre, a.slug, a.orden,
            COALESCE(
              ARRAY(SELECT t.talento
                      FROM gcc_world.ambito_talentos t
                     WHERE t.ambito_id = a.id
                     ORDER BY t.orden, t.talento),
              '{}'
            ) AS talentos
       FROM gcc_world.ambitos a
      ORDER BY a.orden, a.id`,
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    nombre: r.nombre,
    slug: r.slug,
    orden: Number(r.orden),
    talentos: r.talentos ?? [],
  }));
}

/**
 * Un `slug` libre a partir del nombre. Si ya existe, añade `-2`, `-3`…
 *
 * Se resuelve aquí y no con un `UNIQUE` que reviente: pedirle al usuario que invente un
 * nombre distinto porque «ya existe» cuando lo que choca es una URL que él no ve es una
 * mala explicación.
 */
async function slugLibre(nombre: string, excluirId?: number): Promise<string> {
  const base = aSlug(nombre) || 'ambito';
  const { rows } = await pool.query(
    `SELECT slug FROM gcc_world.ambitos WHERE slug LIKE $1 || '%' AND ($2::bigint IS NULL OR id <> $2)`,
    [base, excluirId ?? null],
  );
  const usados = new Set(rows.map((r: any) => r.slug));
  if (!usados.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

export async function crearAmbito(nombre: string): Promise<Ambito> {
  const slug = await slugLibre(nombre);
  const { rows: [max] } = await pool.query(
    `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM gcc_world.ambitos`,
  );
  const { rows: [a] } = await pool.query(
    `INSERT INTO gcc_world.ambitos (nombre, slug, orden) VALUES ($1, $2, $3)
     RETURNING id, nombre, slug, orden`,
    [nombre, slug, Number(max.siguiente)],
  );
  return { id: Number(a.id), nombre: a.nombre, slug: a.slug, orden: Number(a.orden), talentos: [] };
}

/**
 * Renombrar NO cambia el `slug`.
 *
 * El slug es una URL: `/ambitos#tecnologia` se comparte y se queda en el navegador de la
 * gente. Corregir una tilde del nombre no puede romper enlaces ya repartidos. Si algún día
 * hace falta cambiarlo, será una acción aparte y consciente.
 */
export async function renombrarAmbito(id: number, nombre: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.ambitos SET nombre = $2, updated_at = now() WHERE id = $1`,
    [id, nombre],
  );
}

export async function borrarAmbito(id: number): Promise<void> {
  // `ON DELETE CASCADE` se lleva sus talentos. No toca ningún proyecto ni ticket: la
  // relación con ellos se calcula, no se guarda.
  await pool.query(`DELETE FROM gcc_world.ambitos WHERE id = $1`, [id]);
}

/**
 * Fija la lista completa de talentos de un ámbito, en el orden recibido.
 *
 * Es un reemplazo y no un «añadir/quitar» suelto porque la pantalla edita la lista entera:
 * mandar el estado final deja imposible que el cliente y el servidor discrepen a medias.
 *
 * ⚠️ Se descarta cualquier nombre que no esté en el catálogo. Un talento inventado aquí
 * jamás casaría con un requerimiento y dejaría una carpeta vacía sin explicación.
 */
export async function fijarTalentos(ambitoId: number, talentos: string[]): Promise<string[]> {
  const validos = talentos.filter((t) => TALENTOS_SET.has(t));
  const unicos = [...new Set(validos)];

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(`DELETE FROM gcc_world.ambito_talentos WHERE ambito_id = $1`, [ambitoId]);
    if (unicos.length) {
      await cliente.query(
        `INSERT INTO gcc_world.ambito_talentos (ambito_id, talento, orden)
         SELECT $1, t.valor, t.ord - 1
           FROM UNNEST($2::text[]) WITH ORDINALITY AS t(valor, ord)`,
        [ambitoId, unicos],
      );
    }
    await cliente.query(`UPDATE gcc_world.ambitos SET updated_at = now() WHERE id = $1`, [ambitoId]);
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  return unicos;
}

/** Reordena los ámbitos según la lista de ids recibida. */
export async function reordenarAmbitos(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await pool.query(
    `UPDATE gcc_world.ambitos a
        SET orden = v.ord - 1, updated_at = now()
       FROM UNNEST($1::bigint[]) WITH ORDINALITY AS v(id, ord)
      WHERE a.id = v.id`,
    [ids],
  );
}

/**
 * Cuántos proyectos y tickets TERMINADOS respalda cada talento pedido.
 *
 * Una sola consulta para todos: pedir uno por talento serían decenas de viajes a la base
 * cada vez que se abre la pestaña.
 */
export async function coberturaDeTalentos(talentos: string[]): Promise<CoberturaTalento[]> {
  if (!talentos.length) return [];
  const { rows } = await pool.query(
    `WITH pedidos AS (SELECT UNNEST($1::text[]) AS talento)
     SELECT p.talento,
            (SELECT COUNT(DISTINCT r.project_id)::int
               FROM gcc_world.project_requirements r
               JOIN gcc_world.projects pr ON pr.id = r.project_id
              WHERE p.talento = ANY(r.talents) AND pr.status = $2) AS proyectos,
            (SELECT COUNT(*)::int
               FROM gcc_world.tickets t
              WHERE p.talento = ANY(t.required_talents) AND t.status = $2) AS tickets
       FROM pedidos p`,
    [talentos, ESTADO_PUBLICABLE],
  );
  return rows.map((r: any) => ({
    talento: r.talento,
    proyectos: Number(r.proyectos ?? 0),
    tickets: Number(r.tickets ?? 0),
  }));
}

/* ═══════════════════════ EL TRABAJO HECHO CON UN TALENTO ═══════════════════════ */

/**
 * Una persona en los círculos de una tarjeta.
 *
 * ⚠️ **Solo datos de CONTACTO** (Fernando, 2026-08-18, textual: *«solo te dije que pongas
 * sus datos de contacto y ya, nada más»*). Ni talento, ni CV, ni enlaces.
 *
 * Lo que esté vacío no se pinta, que es la regla que él mismo fijó el 2026-08-14 al quitar
 * los interruptores `share_email`/`share_phone`: **el campo vacío YA es el interruptor**.
 */
export interface Persona {
  memberId: number;
  nombre: string;
  foto: string | null;
  correo: string | null;
  telefono: string | null;
  /** `responsible` marca el círculo; NO se enseña en la burbuja. */
  rol: 'responsible' | 'participant';
}

/** Una tarjeta de la columna derecha: un proyecto o un ticket terminado. */
export interface Trabajo {
  tipo: 'proyecto' | 'ticket';
  id: number;
  titulo: string;
  descripcion: string | null;
  etiquetas: string[];
  /** URLs directas (Cloudinary). Los tickets no tienen. */
  imagenes: string[];
  personas: Persona[];
  /** Para ordenar por «lo más reciente». */
  fecha: string | null;
}

/**
 * ⚠️ QUIÉN PARTICIPÓ EN UN PROYECTO SALE DE **TRES** TABLAS, NO DE UNA.
 *
 * Parece que bastaría `project_members`, y es la trampa: medido contra producción, de los
 * **11 proyectos terminados solo 1** tiene fila ahí. Los otros diez registran la
 * participación por **puja aceptada** (`project_bids`) o por **asignación de un
 * requerimiento** (`requirement_assignments`), que son los caminos por los que se trabajaba
 * antes de que existiera `project_members`.
 *
 * Es exactamente la misma condición que ya usa el CV público para decidir qué proyectos
 * enseña (`lib/members/cv-share.ts`). Si aquí se mirara solo una tabla, diez de las once
 * tarjetas saldrían **sin un solo círculo** y nadie sabría por qué.
 */
const PARTICIPANTES_DE_PROYECTO = `
  SELECT DISTINCT ON (m.id) m.id AS member_id, m.name, m.photo_url, m.email, m.phone, x.rol
    FROM (
      SELECT pm.member_id, pm.role AS rol
        FROM gcc_world.project_members pm
       WHERE pm.project_id = $1 AND pm.status = 'active'
      UNION ALL
      SELECT b.member_id, 'participant'
        FROM gcc_world.project_bids b
       WHERE b.project_id = $1 AND b.status = 'accepted'
      UNION ALL
      SELECT ra.member_id, 'participant'
        FROM gcc_world.requirement_assignments ra
        JOIN gcc_world.project_requirements pr ON pr.id = ra.requirement_id
       WHERE pr.project_id = $1
    ) x
    JOIN gcc_world.members m ON m.id = x.member_id
   -- 'responsible' gana a 'participant' cuando la misma persona llega por dos vías.
   ORDER BY m.id, (x.rol = 'responsible') DESC
`;

/**
 * Todo el trabajo TERMINADO hecho con un talento: proyectos y tickets, lo más reciente
 * primero.
 *
 * Se usa desde la página pública `/ambitos`, en el servidor, al generar el HTML.
 */
export async function trabajoDeTalento(talento: string): Promise<Trabajo[]> {
  const { rows: proyectos } = await pool.query(
    `SELECT DISTINCT p.id, p.title, p.description, p.tags, p.images, p.updated_at
       FROM gcc_world.projects p
       JOIN gcc_world.project_requirements r ON r.project_id = p.id
      WHERE p.status = $2 AND $1 = ANY(r.talents)
      ORDER BY p.updated_at DESC NULLS LAST, p.id DESC`,
    [talento, ESTADO_PUBLICABLE],
  );

  const conPersonas: Trabajo[] = [];
  for (const p of proyectos) {
    const { rows: personas } = await pool.query(PARTICIPANTES_DE_PROYECTO, [p.id]);
    conPersonas.push({
      tipo: 'proyecto',
      id: Number(p.id),
      titulo: p.title,
      descripcion: p.description ?? null,
      etiquetas: p.tags ?? [],
      imagenes: (p.images ?? []).filter((x: unknown) => typeof x === 'string' && x),
      personas: personas.map((m: any) => ({
        memberId: Number(m.member_id),
        nombre: m.name,
        foto: m.photo_url ?? null,
        correo: m.email ?? null,
        telefono: m.phone ?? null,
        rol: m.rol === 'responsible' ? 'responsible' : 'participant',
      })),
      fecha: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    });
  }

  // Los tickets: su participante es el miembro asignado, si lo hubo.
  const { rows: tickets } = await pool.query(
    `SELECT t.id, t.title, t.description, t.required_talents, t.updated_at,
            m.id AS member_id, m.name, m.photo_url, m.email, m.phone
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
      WHERE t.status = $2 AND $1 = ANY(t.required_talents)
      ORDER BY t.updated_at DESC NULLS LAST, t.id DESC`,
    [talento, ESTADO_PUBLICABLE],
  );

  const deTickets: Trabajo[] = tickets.map((t: any) => ({
    tipo: 'ticket' as const,
    id: Number(t.id),
    titulo: t.title,
    descripcion: t.description ?? null,
    // El ticket no tiene tags propios: sus talentos hacen de etiqueta.
    etiquetas: t.required_talents ?? [],
    imagenes: [],
    personas: t.member_id
      ? [{
          memberId: Number(t.member_id),
          nombre: t.name,
          foto: t.photo_url ?? null,
          correo: t.email ?? null,
          telefono: t.phone ?? null,
          rol: 'responsible' as const,
        }]
      : [],
    fecha: t.updated_at ? new Date(t.updated_at).toISOString() : null,
  }));

  return [...conPersonas, ...deTickets].sort(
    (a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''),
  );
}
