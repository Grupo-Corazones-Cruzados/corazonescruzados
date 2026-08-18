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
