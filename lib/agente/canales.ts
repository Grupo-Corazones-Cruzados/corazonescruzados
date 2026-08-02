/**
 * Canales del agente: resolver a QUÉ CLIENTE pertenece cada mensaje, y leer sus secretos.
 *
 * Es la pieza que arregla el primer acoplamiento a un solo cliente que señalaba la guía.
 * En el sistema de Peters Tours el webhook hacía `canalPorSlug(CANAL_POR_DEFECTO)`: había
 * un canal y punto. Aquí el canal se resuelve por el `phone_number_id` que Meta manda en
 * `value.metadata`, que es único por número y por tanto por cliente.
 */

import { pool } from '@/lib/db';
import { contextoCanal, descifrarONulo, cifrar, estaCifrado, type CampoSecreto } from './cifrado';

export interface Canal {
  id: number;
  flow_id: number;
  waba_id: string | null;
  phone_number_id: string | null;
  numero_visible: string | null;
  nombre_verificado: string | null;
  ia_proveedor: string;
  modelo: string;
  max_tokens: number;
  debounce_segundos: number;
  ventana_mensajes: number;
  bot_activo: boolean;
  estado: string;
  coexistencia_verificada: boolean;
  ultimo_error: string | null;
  /** Presentes en la fila pero NUNCA se devuelven al navegador. */
  wa_token_cifrado: string | null;
  ia_api_key_cifrada: string | null;
  pin_cifrado: string | null;
}

/** El canal al que pertenece un número. Es la resolución del tenant. */
export async function canalPorNumero(phoneNumberId: string): Promise<Canal | null> {
  if (!phoneNumberId) return null;
  const { rows } = await pool.query<Canal>(
    `SELECT * FROM gcc_world.agente_canales WHERE phone_number_id = $1`,
    [phoneNumberId],
  );
  return rows[0] ?? null;
}

/** El canal por su id. Lo usa el runner al reclamar un trabajo de la cola. */
export async function canalPorId(id: number): Promise<Canal | null> {
  const { rows } = await pool.query<Canal>(
    `SELECT * FROM gcc_world.agente_canales WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function canalPorFlujo(flowId: number): Promise<Canal | null> {
  const { rows } = await pool.query<Canal>(
    `SELECT * FROM gcc_world.agente_canales WHERE flow_id = $1`,
    [flowId],
  );
  return rows[0] ?? null;
}

/** Crea el canal de un flujo si aún no existe. Idempotente: el alta se puede reintentar. */
export async function asegurarCanal(flowId: number): Promise<Canal> {
  const { rows } = await pool.query<Canal>(
    `INSERT INTO gcc_world.agente_canales (flow_id) VALUES ($1)
     ON CONFLICT (flow_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [flowId],
  );
  return rows[0];
}

/**
 * Descifra un secreto del canal. Devuelve `null` si no hay o si no se puede descifrar
 * —clave maestra distinta, fila manipulada— en vez de reventar: quien llama decide qué
 * hacer, y en el caso del agente eso significa escalar a una persona, no callar.
 */
export function secretoDelCanal(canal: Canal, campo: CampoSecreto): string | null {
  const columna =
    campo === 'wa_token' ? canal.wa_token_cifrado
    : campo === 'ia_api_key' ? canal.ia_api_key_cifrada
    : canal.pin_cifrado;
  return descifrarONulo(columna, contextoCanal(canal.id, campo));
}

/** Guarda un secreto cifrado. Si ya venía cifrado no lo cifra dos veces. */
export async function guardarSecreto(canalId: number, campo: CampoSecreto, valor: string): Promise<void> {
  const columna =
    campo === 'wa_token' ? 'wa_token_cifrado'
    : campo === 'ia_api_key' ? 'ia_api_key_cifrada'
    : 'pin_cifrado';
  const blob = estaCifrado(valor) ? valor : cifrar(valor, contextoCanal(canalId, campo));
  await pool.query(
    `UPDATE gcc_world.agente_canales SET ${columna} = $1, updated_at = NOW() WHERE id = $2`,
    [blob, canalId],
  );
}

/**
 * Deja constancia de un fallo en el canal, visible en el panel.
 *
 * Existe por la lección más cara del proyecto anterior: el token caducó, el agente siguió
 * recibiendo pero no podía enviar, y **no hubo ninguna alerta**. Un agente mudo en
 * silencio es el peor final posible, así que todo fallo del canal se escribe aquí.
 */
export async function anotarError(canalId: number, mensaje: string): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.agente_canales
        SET ultimo_error = $1, ultimo_error_en = NOW(), updated_at = NOW()
      WHERE id = $2`,
    [mensaje.slice(0, 2000), canalId],
  );
}

export async function limpiarError(canalId: number): Promise<void> {
  await pool.query(
    `UPDATE gcc_world.agente_canales SET ultimo_error = NULL, ultimo_error_en = NULL WHERE id = $1`,
    [canalId],
  );
}

/** Lo que sí puede ver el navegador: todo menos los secretos. */
export function canalPublico(canal: Canal) {
  const { wa_token_cifrado, ia_api_key_cifrada, pin_cifrado, ...resto } = canal;
  return {
    ...resto,
    tiene_wa_token: Boolean(wa_token_cifrado),
    tiene_ia_api_key: Boolean(ia_api_key_cifrada),
    tiene_pin: Boolean(pin_cifrado),
  };
}
