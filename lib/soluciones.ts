/**
 * ÁMBITOS — acceso a datos, definición única.
 *
 * Un **solución** es un tipo de proyecto que el grupo sabe manejar (Tecnología, …). Dentro
 * lleva **talentos** del catálogo de la organización (`lib/centralized/talentos.ts`), y son
 * esos talentos los que enganchan con el trabajo hecho:
 *
 *     solución ──▶ talentos ──▶ proyectos  (por `project_requirements.talents`)
 *                        └──▶ tickets    (por `tickets.required_talents`)
 *
 * **Ese enganche no se guarda en ninguna parte: se consulta.** Es la misma regla que fijó
 * la migración 037 para el CV público —«un proyecto pertenece a un talento si alguno de sus
 * requerimientos pide ese talento»— y evita el clásico dato duplicado que un día deja de
 * cuadrar.
 *
 * Lo consumen dos sitios, como las FAQs:
 *  · **Admin → Soluciones**, por la API (`/api/admin/soluciones`).
 *  · **La web pública** (`/soluciones`), que leerá esta capa **directamente en el servidor** al
 *    generar la página. Sería absurdo que la aplicación se llamara a sí misma por HTTP para
 *    leer su propia base.
 *
 * Tabla: `gcc_world.soluciones` + `gcc_world.solucion_talentos` (migración 039).
 */

import { pool } from '@/lib/db';
import { TALENTOS_SET } from '@/lib/centralized/talentos';

/**
 * Un talento DENTRO de una solución.
 *
 * Deja de ser una cadena suelta desde el 2026-08-18: lleva su **descripción**, que cuenta
 * cómo se ejerce ese talento en ESTA solución y se publica bajo su título en `/soluciones`.
 *
 * ⚠️ **Un talento pertenece a UN SOLO solución** (Fernando, 2026-08-18; índice único en la
 * migración 042). El solución clasifica, y algo que cae en dos cajones no está clasificado.
 *
 * Que la pareja sea única **no** convierte la descripción en propiedad del talento: sigue
 * describiendo *el talento ejercido dentro de su solución*, y el catálogo de talentos vive en
 * el código, no en la base. Lo confirmó él mismo: *«la descripción queda entre solución y
 * talento, no es lo mismo que la descripción del talento per se»*.
 */
export interface TalentoDeSolucion {
  talento: string;
  descripcion: string | null;
  /**
   * El tramo de la URL: `/soluciones/<slug>`. Se guarda en la base y **no se recalcula**
   * (migración 043): es una dirección publicada, y derivarla del nombre en cada petición
   * movería enlaces ya repartidos ante cualquier retoque del catálogo.
   */
  slug: string;
}

export interface Solucion {
  id: number;
  nombre: string;
  slug: string;
  orden: number;
  /** Los talentos asociados, en su orden. */
  talentos: TalentoDeSolucion[];
}

/**
 * Cuánto trabajo TERMINADO respalda a un talento.
 *
 * Se enseña en el admin para que, al montar una solución, se vea de inmediato si va a salir
 * vacío en la web. Una solución con talentos sin nada detrás es una carpeta que el visitante
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

/** Todos los soluciones con sus talentos, en orden. */
export async function listarSoluciones(): Promise<Solucion[]> {
  const { rows } = await pool.query(
    `SELECT a.id, a.nombre, a.slug, a.orden,
            COALESCE(
              (SELECT json_agg(json_build_object('talento', t.talento,
                                                 'descripcion', t.descripcion,
                                                 'slug', t.slug)
                               ORDER BY t.orden, t.talento)
                 FROM gcc_world.solucion_talentos t
                WHERE t.solucion_id = a.id),
              '[]'::json
            ) AS talentos
       FROM gcc_world.soluciones a
      ORDER BY a.orden, a.id`,
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    nombre: r.nombre,
    slug: r.slug,
    orden: Number(r.orden),
    talentos: (r.talentos ?? []) as TalentoDeSolucion[],
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
  const base = aSlug(nombre) || 'solucion';
  const { rows } = await pool.query(
    `SELECT slug FROM gcc_world.soluciones WHERE slug LIKE $1 || '%' AND ($2::bigint IS NULL OR id <> $2)`,
    [base, excluirId ?? null],
  );
  const usados = new Set(rows.map((r: any) => r.slug));
  if (!usados.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!usados.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now()}`;
}

export async function crearSolucion(nombre: string): Promise<Solucion> {
  const slug = await slugLibre(nombre);
  const { rows: [max] } = await pool.query(
    `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM gcc_world.soluciones`,
  );
  const { rows: [a] } = await pool.query(
    `INSERT INTO gcc_world.soluciones (nombre, slug, orden) VALUES ($1, $2, $3)
     RETURNING id, nombre, slug, orden`,
    [nombre, slug, Number(max.siguiente)],
  );
  return { id: Number(a.id), nombre: a.nombre, slug: a.slug, orden: Number(a.orden), talentos: [] };
}

/**
 * Renombrar NO cambia el `slug`.
 *
 * El slug es una URL: `/soluciones#tecnologia` se comparte y se queda en el navegador de la
 * gente. Corregir una tilde del nombre no puede romper enlaces ya repartidos. Si algún día
 * hace falta cambiarlo, será una acción aparte y consciente.
 */
export async function renombrarSolucion(id: number, nombre: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.soluciones SET nombre = $2, updated_at = now() WHERE id = $1`,
    [id, nombre],
  );
}

export async function borrarSolucion(id: number): Promise<void> {
  // `ON DELETE CASCADE` se lleva sus talentos. No toca ningún proyecto ni ticket: la
  // relación con ellos se calcula, no se guarda.
  await pool.query(`DELETE FROM gcc_world.soluciones WHERE id = $1`, [id]);
}

/**
 * Los talentos que ya están cogidos por OTRO solución.
 *
 * El panel del admin los esconde del catálogo: un talento pertenece a uno solo, y ofrecer
 * uno que va a ser rechazado por la base es prometer algo que no se puede cumplir.
 */
export async function talentosOcupados(exceptoSolucionId?: number): Promise<Record<string, string>> {
  const { rows } = await pool.query(
    `SELECT t.talento, a.nombre
       FROM gcc_world.solucion_talentos t
       JOIN gcc_world.soluciones a ON a.id = t.solucion_id
      WHERE $1::bigint IS NULL OR t.solucion_id <> $1`,
    [exceptoSolucionId ?? null],
  );
  return Object.fromEntries(rows.map((r: any) => [r.talento, r.nombre]));
}

/**
 * Fija la lista completa de talentos de una solución, en el orden recibido.
 *
 * Es un reemplazo y no un «añadir/quitar» suelto porque la pantalla edita la lista entera:
 * mandar el estado final deja imposible que el cliente y el servidor discrepen a medias.
 *
 * ⚠️ Se descarta cualquier nombre que no esté en el catálogo. Un talento inventado aquí
 * jamás casaría con un requerimiento y dejaría una carpeta vacía sin explicación.
 *
 * ── ⭐ SE GUARDA POR DIFERENCIAS, NO BORRANDO Y REINSERTANDO (2026-08-21) ─────
 * Hasta la migración 051 esta función hacía `DELETE` de todos los talentos de la solución y
 * los volvía a insertar. Daba igual porque de la fila del talento no colgaba nada. **Ahora
 * cuelgan sus conceptos** con `ON DELETE CASCADE`, así que aquel borrado en bloque habría
 * vaciado los conceptos de todos los talentos en CADA guardado —incluso al no cambiar nada,
 * incluso al reordenar—. Se borra solo lo que de verdad se ha quitado.
 */
export async function fijarTalentos(
  solucionId: number,
  talentos: TalentoDeSolucion[],
): Promise<TalentoDeSolucion[]> {
  const vistos = new Set<string>();
  const unicos = talentos.filter((t) => {
    if (!TALENTOS_SET.has(t.talento) || vistos.has(t.talento)) return false;
    vistos.add(t.talento);
    return true;
  });

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // Fuera SOLO los que ya no están en la lista. Los que siguen conservan su fila —y con
    // ella sus conceptos, que cuelgan del talento (migración 051).
    await cliente.query(
      `DELETE FROM gcc_world.solucion_talentos
        WHERE solucion_id = $1 AND NOT (talento = ANY($2::text[]))`,
      [solucionId, unicos.map((t) => t.talento)],
    );
    if (unicos.length) {
      await cliente.query(
        `INSERT INTO gcc_world.solucion_talentos (solucion_id, talento, orden, descripcion, slug)
         SELECT $1, t.valor, t.ord - 1, d.valor, s.valor
           FROM UNNEST($2::text[]) WITH ORDINALITY AS t(valor, ord)
           JOIN UNNEST($3::text[]) WITH ORDINALITY AS d(valor, ord) ON d.ord = t.ord
           JOIN UNNEST($4::text[]) WITH ORDINALITY AS s(valor, ord) ON s.ord = t.ord
         ON CONFLICT (solucion_id, talento) DO UPDATE
            SET orden = EXCLUDED.orden, descripcion = EXCLUDED.descripcion`,
        [
          solucionId,
          unicos.map((t) => t.talento),
          unicos.map((t) => t.descripcion ?? null),
          // El slug se calcula aquí con la MISMA regla que usó la migración 043, y solo
          // se usa al INSERTAR: el `DO UPDATE` no lo toca, porque es una URL publicada
          // (migración 043) y no algo que se reescriba en cada guardado.
          unicos.map((t) => aSlug(t.talento)),
        ],
      );
    }
    await cliente.query(`UPDATE gcc_world.soluciones SET updated_at = now() WHERE id = $1`, [solucionId]);
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
  return unicos.map((t) => ({ ...t, slug: aSlug(t.talento) }));
}

/** Reordena los soluciones según la lista de ids recibida. */
export async function reordenarSoluciones(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await pool.query(
    `UPDATE gcc_world.soluciones a
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
  /**
   * ⚠️ **CUÁNDO SE CREÓ, no cuándo se tocó por última vez** (Fernando, 2026-08-18).
   *
   * Hasta hoy esto era `updated_at` y solo servía para ordenar. No vale para enseñarlo: el
   * 2026-08-18 se reescribieron de golpe los títulos y descripciones de los 30 registros para
   * quitar nombres de clientes, así que **los 30 `updated_at` son del mismo segundo**. Puesta
   * a la vista, esa fecha diría «todo se hizo ayer», que es falso y además inútil.
   *
   * `created_at` está relleno en los 30 (comprobado contra producción), y va de marzo a agosto
   * de 2026: es la fecha que de verdad sitúa cada trabajo en el tiempo.
   */
  creado: string | null;
  /**
   * La misma fecha ya escrita («02 ago 2026»), formateada **en el servidor**.
   *
   * La tarjeta es un componente de cliente, así que la pinta el servidor y luego la hidrata el
   * navegador. Formatear allí con `toLocaleDateString` es pedir un desajuste de hidratación: el
   * servidor y el navegador no tienen por qué traer los mismos datos de idioma ni la misma zona
   * horaria. Formateado una vez aquí, las dos pasadas escriben exactamente lo mismo.
   */
  creadoTexto: string | null;
}

/**
 * La fecha como se lee en el sitio: `02 ago 2026`.
 *
 * `es-EC` con día de dos cifras y mes abreviado es lo que ya usan `/proyecto/[id]` y
 * `/cotizacion/[id]`; no se inventa un formato nuevo para esta página.
 *
 * `timeZone: 'UTC'` a propósito: la fecha se guarda en UTC y quien mira la página puede estar
 * en cualquier huso. Sin fijarla, un ticket de las 22:30 UTC saldría con el día anterior en
 * Ecuador y con el día correcto en Madrid — la misma tarjeta contando dos cosas distintas.
 */
function comoFecha(v: unknown): string | null {
  if (!v) return null;
  return new Date(v as string).toLocaleDateString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
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
 * Se usa desde la página pública `/soluciones`, en el servidor, al generar el HTML.
 */
export async function trabajoDeTalento(talento: string): Promise<Trabajo[]> {
  const { rows: proyectos } = await pool.query(
    `SELECT DISTINCT p.id, p.title, p.description, p.tags, p.images, p.created_at
       FROM gcc_world.projects p
       JOIN gcc_world.project_requirements r ON r.project_id = p.id
      WHERE p.status = $2 AND $1 = ANY(r.talents)
      ORDER BY p.created_at DESC NULLS LAST, p.id DESC`,
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
      creado: p.created_at ? new Date(p.created_at).toISOString() : null,
      creadoTexto: comoFecha(p.created_at),
    });
  }

  // Los tickets: su participante es el miembro asignado, si lo hubo.
  const { rows: tickets } = await pool.query(
    `SELECT t.id, t.title, t.description, t.required_talents, t.created_at,
            m.id AS member_id, m.name, m.photo_url, m.email, m.phone
       FROM gcc_world.tickets t
       LEFT JOIN gcc_world.members m ON m.id = t.member_id
      WHERE t.status = $2 AND $1 = ANY(t.required_talents)
      ORDER BY t.created_at DESC NULLS LAST, t.id DESC`,
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
    creado: t.created_at ? new Date(t.created_at).toISOString() : null,
    creadoTexto: comoFecha(t.created_at),
  }));

  // ⚠️ Se ordena por la MISMA fecha que se enseña. Ordenar por `updated_at` y pintar
  // `created_at` dejaría las tarjetas con las fechas desordenadas a la vista, que se lee como
  // un fallo. Y con los 30 `updated_at` puestos en el mismo segundo por la limpieza de
  // nombres, ese orden ya no significaba nada.
  return [...conPersonas, ...deTickets].sort(
    (a, b) => (b.creado ?? '').localeCompare(a.creado ?? ''),
  );
}


/* ═══════════════════ EL CONTENIDO DE LAS CUATRO PESTAÑAS ═══════════════════ */

/**
 * Un miembro que TIENE este talento, para la pestaña «Talentos».
 *
 * ⚠️ Solo datos de contacto, igual que la burbuja de las tarjetas: nombre, foto, correo y
 * teléfono. Lo que esté vacío no se pinta.
 */
export interface MiembroConTalento {
  memberId: number;
  nombre: string;
  foto: string | null;
  correo: string | null;
  telefono: string | null;
}

/** Un producto del catálogo, para la pestaña «Productos». */
export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  precio: number | null;
}

/** Todo lo que se enseña de un talento, ya repartido por pestaña. */
export interface ContenidoDeTalento {
  miembros: MiembroConTalento[];
  productos: Producto[];
  proyectos: Trabajo[];
  tickets: Trabajo[];
}

/**
 * QUIÉN TIENE ESTE TALENTO.
 *
 * Sale de `member_cv_profiles.talents`, un jsonb de `[{key, …}]` donde `key` es el nombre
 * del talento — la misma estructura que organiza el CV público por talento desde la
 * migración 037. No hay una tabla «miembro↔talento»: el CV es quien lo declara.
 */
export async function miembrosConTalento(talento: string): Promise<MiembroConTalento[]> {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.photo_url, m.email, m.phone
       FROM gcc_world.member_cv_profiles c
       JOIN gcc_world.members m ON m.id = c.member_id
      WHERE EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(c.talents, '[]'::jsonb)) t
               WHERE t->>'key' = $1
            )
      ORDER BY m.name`,
    [talento],
  );
  return rows.map((m: any) => ({
    memberId: Number(m.id),
    nombre: m.name,
    foto: m.photo_url ?? null,
    correo: m.email ?? null,
    telefono: m.phone ?? null,
  }));
}

/**
 * LOS PRODUCTOS DE ESTE TALENTO.
 *
 * Un producto no declara talento: cuelga de un ítem del portafolio
 * (`products.portfolio_item_id`), y **es ese ítem el que lo declara**
 * (`member_portfolio_items.talent`, migración 037). Se sigue esa cadena en vez de añadir
 * una columna que habría que mantener a la par.
 *
 * Solo los activos: un producto retirado no se anuncia en la web.
 */
export async function productosDeTalento(talento: string): Promise<Producto[]> {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.image_url, p.price
       FROM gcc_world.products p
       JOIN gcc_world.member_portfolio_items i ON i.id = p.portfolio_item_id
      WHERE i.talent = $1 AND COALESCE(p.is_active, true) = true
      ORDER BY p.updated_at DESC NULLS LAST, p.id DESC`,
    [talento],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    nombre: r.name,
    descripcion: r.description ?? null,
    imagen: r.image_url ?? null,
    precio: r.price === null || r.price === undefined ? null : Number(r.price),
  }));
}

/** Todo lo de un talento, en una llamada: es lo que consume la página pública. */
export async function contenidoDeTalento(talento: string): Promise<ContenidoDeTalento> {
  const [miembros, productos, trabajo] = await Promise.all([
    miembrosConTalento(talento),
    productosDeTalento(talento),
    trabajoDeTalento(talento),
  ]);
  return {
    miembros,
    productos,
    proyectos: trabajo.filter((t) => t.tipo === 'proyecto'),
    tickets: trabajo.filter((t) => t.tipo === 'ticket'),
  };
}

/**
 * El talento que hay detrás de una URL, o `null` si esa URL no existe.
 *
 * Lo usa `/soluciones/<slug>` para saber qué enseñar y para responder **404 de verdad** cuando
 * alguien escribe un tramo inventado — no una página vacía, que es lo que hace pensar que
 * algo se rompió.
 */
export async function talentoPorSlug(
  slug: string,
): Promise<{ talento: string; descripcion: string | null; solucionId: number } | null> {
  const { rows: [r] } = await pool.query(
    `SELECT talento, descripcion, solucion_id FROM gcc_world.solucion_talentos WHERE slug = $1`,
    [slug],
  );
  return r ? { talento: r.talento, descripcion: r.descripcion ?? null, solucionId: Number(r.solucion_id) } : null;
}

/* ═══════════════════════ LOS CONCEPTOS DE UN TALENTO ═══════════════════════ */

/**
 * Un **concepto**: título, icono y descripción.
 *
 * Se publican en `/soluciones` como una tira vertical en el panel derecho — el mismo
 * carrusel que tenía la galería de Automatización, girado. Se editan en Admin → Soluciones,
 * dentro del panel del talento.
 *
 * ⚠️ **Cuelgan del TALENTO desde la migración 051** (Fernando, 2026-08-21), no de la
 * solución. Los once primeros —Robots Automatizados, ERP Modular, Sitios Web…— son todos
 * formas de ejercer «Automatización de procesos»; colgados de la solución, un segundo
 * talento bajo el mismo cajón habría enseñado once conceptos que no son suyos.
 *
 * ⚠️ `icono` es una **clave del mapa `ICONOS`** (`components/sitio/piezas.tsx`), no un
 * archivo: pesa cero, cambia de color con el tema y se sustituye en un solo sitio.
 */
export interface Concepto {
  id: number;
  titulo: string;
  icono: string;
  descripcion: string | null;
  orden: number;
}

/** Los conceptos de un talento, en su orden. */
export async function conceptosDeTalento(talento: string): Promise<Concepto[]> {
  const { rows } = await pool.query(
    `SELECT id, titulo, icono, descripcion, orden
       FROM gcc_world.solucion_conceptos
      WHERE talento = $1
      ORDER BY orden, id`,
    [talento],
  );
  return rows.map(aConcepto);
}

/**
 * TODOS los conceptos, agrupados por talento.
 *
 * Una sola consulta para la página pública y para el admin: pedirlos talento por talento
 * serían tantos viajes a la base como carpetas tenga el panel izquierdo.
 */
export async function conceptosPorTalento(): Promise<Record<string, Concepto[]>> {
  const { rows } = await pool.query(
    `SELECT talento, id, titulo, icono, descripcion, orden
       FROM gcc_world.solucion_conceptos
      ORDER BY talento, orden, id`,
  );
  const salida: Record<string, Concepto[]> = {};
  for (const r of rows) (salida[r.talento] ??= []).push(aConcepto(r));
  return salida;
}

function aConcepto(r: any): Concepto {
  return {
    id: Number(r.id),
    titulo: r.titulo,
    icono: r.icono,
    descripcion: r.descripcion ?? null,
    orden: Number(r.orden),
  };
}

export async function crearConcepto(
  talento: string,
  datos: { titulo: string; icono: string; descripcion: string | null },
): Promise<Concepto> {
  const { rows: [max] } = await pool.query(
    `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente
       FROM gcc_world.solucion_conceptos WHERE talento = $1`,
    [talento],
  );
  const { rows: [c] } = await pool.query(
    `INSERT INTO gcc_world.solucion_conceptos (talento, titulo, icono, descripcion, orden)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, titulo, icono, descripcion, orden`,
    [talento, datos.titulo, datos.icono, datos.descripcion, Number(max.siguiente)],
  );
  return aConcepto(c);
}

export async function editarConcepto(
  id: number,
  datos: { titulo: string; icono: string; descripcion: string | null },
): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.solucion_conceptos
        SET titulo = $2, icono = $3, descripcion = $4, updated_at = now()
      WHERE id = $1`,
    [id, datos.titulo, datos.icono, datos.descripcion],
  );
}

export async function borrarConcepto(id: number): Promise<void> {
  await pool.query(`DELETE FROM gcc_world.solucion_conceptos WHERE id = $1`, [id]);
}

/** Reordena los conceptos de un talento según la lista de ids recibida. */
export async function reordenarConceptos(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await pool.query(
    `UPDATE gcc_world.solucion_conceptos c
        SET orden = v.ord - 1, updated_at = now()
       FROM UNNEST($1::bigint[]) WITH ORDINALITY AS v(id, ord)
      WHERE c.id = v.id`,
    [ids],
  );
}
