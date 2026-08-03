/**
 * Ayudantes de la bandeja compartidos por sus rutas.
 *
 * Vive en `lib/` y no en el `route.ts` a propósito: un fichero de ruta de Next **solo
 * puede exportar manejadores** (`GET`, `POST`, …). Exportar de ahí una función auxiliar
 * compila con `tsc` pero rompe el `next build` con un error de tipos poco evidente.
 */

import { pool } from '@/lib/db';
import { asegurarCanal, type Canal } from './canales';
import { flujoPermitido } from '@/lib/flows/acceso';
import type { TokenPayload } from '@/lib/auth/jwt';

/**
 * Resuelve la conversación filtrando TAMBIÉN por canal: con el id de una conversación de
 * otro cliente se responde 404 en vez de enseñar sus chats. En un producto multi-tenant
 * esto no es una comprobación de más — es la que evita el peor fallo posible.
 */
/**
 * ⚠️ Pide el `user` a propósito, y el flujo lo trae `flujoPermitido()`.
 *
 * Es el único sitio por el que pasan las tres rutas de una conversación —ver el hilo,
 * tomarla, responder—, así que comprobar aquí las cubre a las tres. Antes bastaba con
 * tener sesión: cualquier cliente podía leer las conversaciones de WhatsApp de otro
 * escribiendo su identificador de flujo en la URL.
 */
export async function conversacionDelFlujo(
  user: TokenPayload | null,
  flowId: string,
  convId: string,
): Promise<{ conv: any; canal: Canal } | null> {
  const flujo = await flujoPermitido(user, flowId);
  if (flujo?.type !== 'ai_agent') return null;
  const canal = await asegurarCanal(flujo.id);
  const { rows: [conv] } = await pool.query(
    `SELECT c.*, ct.wa_id, ct.nombre_perfil
       FROM gcc_world.agente_conversaciones c
       JOIN gcc_world.agente_contactos ct ON ct.id = c.contacto_id
      WHERE c.id = $1 AND c.canal_id = $2`,
    [convId, canal.id],
  );
  return conv ? { conv, canal } : null;
}
