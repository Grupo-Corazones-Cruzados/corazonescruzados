/**
 * QUIÉN PUEDE VER QUÉ FLUJO — la respuesta vive aquí y en ningún otro sitio.
 *
 * ── EL AGUJERO QUE CIERRA ──────────────────────────────────────────────────────
 * `GET /api/admin/flows` devolvía TODOS los flujos a cualquier usuario con sesión, y las
 * 26 rutas de detalle solo comprobaban que hubiera sesión — ninguna miraba de quién era el
 * flujo. Con un solo cliente no se notaba; con dos, el cliente A abre la bandeja del
 * cliente B y lee sus conversaciones de WhatsApp, o su clave de IA.
 *
 * ── LAS TRES REGLAS ────────────────────────────────────────────────────────────
 * 1. **Administrador**: lo ve todo. Es quien opera la plataforma.
 * 2. **Responsable** del flujo: lo ve, aunque no sea administrador. Es quien lo lleva.
 * 3. **Cliente**: ve los flujos que tengan su ficha en `flow_clients`, y solo esos.
 *
 * Un flujo **sin clientes** es interno de GCC: solo administradores y su responsable.
 *
 * ── POR QUÉ UNA FUNCIÓN Y NO UN `if` EN CADA RUTA ──────────────────────────────
 * Son 27 rutas. Una regla copiada 27 veces es una regla que en la número 19 está mal y
 * nadie lo nota hasta que un cliente ve lo que no debe. Aquí se decide una vez; las rutas
 * solo preguntan.
 *
 * ⚠️ La comprobación va **en el servidor, por petición**. Esconder el flujo de la lista no
 * es seguridad: la ruta de detalle se llama escribiendo la URL.
 */

import { pool } from '@/lib/db';
import type { TokenPayload } from '@/lib/auth/jwt';

/** La ficha del cliente que corresponde a un usuario, si la tiene. */
async function clienteDe(userId: string): Promise<string | null> {
  const { rows: [c] } = await pool.query(
    `SELECT id FROM gcc_world.clients WHERE user_id = $1 LIMIT 1`, [userId],
  );
  return c?.id ?? null;
}

/**
 * El fragmento de SQL que filtra los flujos visibles, y sus parámetros.
 *
 * Se devuelve como trozo de consulta —y no como una lista de identificadores— para que el
 * filtro ocurra **dentro** de la consulta que ya hace la ruta: traerse todos los flujos y
 * descartarlos en memoria es la forma habitual de que un `LIMIT` acabe devolviendo de más.
 */
export async function filtroDeFlujos(
  user: TokenPayload,
  { alias = 'f' }: { alias?: string } = {},
): Promise<{ sql: string; params: any[] }> {
  if (user.role === 'admin') return { sql: 'TRUE', params: [] };

  const clientId = await clienteDe(user.userId);
  // `$1` y `$2` los renumera quien lo use; se documenta el orden: [userId, clientId].
  return {
    sql: `(${alias}.responsable_user_id = $1
           OR EXISTS (SELECT 1 FROM gcc_world.flow_clients fc
                       WHERE fc.flow_id = ${alias}.id AND fc.client_id = $2))`,
    params: [user.userId, clientId],
  };
}

/**
 * ¿Puede este usuario tocar este flujo? Devuelve el flujo, o `null`.
 *
 * Devolver el flujo y no un booleano ahorra la consulta que la ruta iba a hacer de todas
 * formas, y evita el hueco clásico: comprobar el acceso con una consulta y leer los datos
 * con otra que no filtra igual.
 */
export async function flujoPermitido(
  user: TokenPayload | null,
  flowId: string | number,
): Promise<any | null> {
  if (!user) return null;

  const { rows: [flujo] } = await pool.query(
    `SELECT * FROM gcc_world.flows WHERE id = $1`, [flowId],
  );
  if (!flujo) return null;
  if (user.role === 'admin') return flujo;
  if (flujo.responsable_user_id === user.userId) return flujo;

  const clientId = await clienteDe(user.userId);
  if (!clientId) return null;

  const { rows: [ficha] } = await pool.query(
    `SELECT 1 FROM gcc_world.flow_clients WHERE flow_id = $1 AND client_id = $2`,
    [flujo.id, clientId],
  );
  return ficha ? flujo : null;
}
