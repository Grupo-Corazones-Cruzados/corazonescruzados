/**
 * PREGUNTAS FRECUENTES DE `/clientes` — acceso a datos, definición única.
 *
 * Las usan dos sitios muy distintos y por eso viven aquí y no dentro de un endpoint:
 *  · La **web pública** (`/clientes/<id>`), que las lee **directamente en el servidor** al
 *    generar la página. No pasa por la API: sería pedirle a la aplicación que se llame a sí
 *    misma por HTTP para leer su propia base.
 *  · El **panel de Admin**, que sí va por `/api/admin/faqs` porque escribe.
 *
 * Tabla: `gcc_world.faqs` (migración `033_faqs_negocio.sql`).
 */

import { pool } from '@/lib/db';

export interface Faq {
  id: number;
  accesoId: string;
  pregunta: string;
  respuesta: string;
  orden: number;
}

/** Fila cruda de la tabla, tal como la devuelve `pg`. */
interface FilaFaq {
  id: string | number;
  acceso_id: string;
  pregunta: string;
  respuesta: string;
  orden: number;
}

/**
 * `BIGSERIAL` llega como **texto** desde `pg` —no cabe garantizado en un número de
 * JavaScript—, así que se convierte aquí una sola vez en lugar de en cada pantalla.
 */
function aFaq(f: FilaFaq): Faq {
  return {
    id: Number(f.id),
    accesoId: f.acceso_id,
    pregunta: f.pregunta,
    respuesta: f.respuesta,
    orden: f.orden,
  };
}

/**
 * Las preguntas de una puerta, en su orden.
 *
 * El desempate por `id` no es adorno: sin él, dos preguntas con el mismo `orden` se
 * intercambian entre recargas —PostgreSQL no promete un orden estable— y la página parecería
 * cambiar sola.
 */
export async function faqsDeAcceso(accesoId: string): Promise<Faq[]> {
  const { rows } = await pool.query<FilaFaq>(
    `SELECT id, acceso_id, pregunta, respuesta, orden
       FROM gcc_world.faqs
      WHERE acceso_id = $1
      ORDER BY orden ASC, id ASC`,
    [accesoId],
  );
  return rows.map(aFaq);
}

/** Cuántas preguntas tiene cada puerta. Alimenta las burbujas del rail del Admin. */
export async function conteoPorAcceso(): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ acceso_id: string; n: string }>(
    `SELECT acceso_id, COUNT(*)::text AS n FROM gcc_world.faqs GROUP BY acceso_id`,
  );
  return Object.fromEntries(rows.map((r: { acceso_id: string; n: string }) => [r.acceso_id, Number(r.n)]));
}

/**
 * Crea una pregunta al final de su lista.
 *
 * El `orden` se calcula aquí —el siguiente hueco— en vez de pedírselo a quien escribe:
 * nadie debería tener que saber qué número toca para añadir una pregunta.
 */
export async function crearFaq(datos: {
  accesoId: string; pregunta: string; respuesta: string;
}): Promise<Faq> {
  const { rows } = await pool.query<FilaFaq>(
    `INSERT INTO gcc_world.faqs (acceso_id, pregunta, respuesta, orden)
     VALUES ($1, $2, $3,
             COALESCE((SELECT MAX(orden) + 1 FROM gcc_world.faqs WHERE acceso_id = $1), 0))
     RETURNING id, acceso_id, pregunta, respuesta, orden`,
    [datos.accesoId, datos.pregunta, datos.respuesta],
  );
  return aFaq(rows[0]);
}

/**
 * Actualiza lo que se le pase. `COALESCE` deja intacto lo que llega como `null`, así que la
 * pantalla puede mandar solo el campo que cambió sin borrar los otros por omisión.
 */
export async function actualizarFaq(
  id: number,
  cambios: { pregunta?: string; respuesta?: string; orden?: number },
): Promise<Faq | null> {
  const { rows } = await pool.query<FilaFaq>(
    `UPDATE gcc_world.faqs
        SET pregunta  = COALESCE($2, pregunta),
            respuesta = COALESCE($3, respuesta),
            orden     = COALESCE($4, orden),
            updated_at = now()
      WHERE id = $1
      RETURNING id, acceso_id, pregunta, respuesta, orden`,
    [id, cambios.pregunta ?? null, cambios.respuesta ?? null, cambios.orden ?? null],
  );
  return rows[0] ? aFaq(rows[0]) : null;
}

export async function borrarFaq(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM gcc_world.faqs WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Reescribe el orden de una puerta entera a partir de la lista de identificadores.
 *
 * Va **en una transacción**: si se aplicaran una a una y algo fallara a mitad, la lista
 * quedaría con la mitad de las posiciones nuevas y la mitad viejas — un desorden peor que el
 * de partida y sin forma de saber dónde se cortó.
 */
export async function reordenarFaqs(accesoId: string, idsEnOrden: number[]): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (let i = 0; i < idsEnOrden.length; i++) {
      await cliente.query(
        `UPDATE gcc_world.faqs SET orden = $1, updated_at = now()
          WHERE id = $2 AND acceso_id = $3`,
        [i, idsEnOrden[i], accesoId],
      );
    }
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}
