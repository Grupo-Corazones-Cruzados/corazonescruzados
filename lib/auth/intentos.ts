/**
 * LÍMITE DE FALLOS DE CONTRASEÑA (seguridad, 2026-11-07).
 *
 * Sin él, cualquiera prueba contraseñas contra una cuenta sin parar. Se corta a los 10 fallos de una cuenta
 * o a los 30 de una IP en 15 minutos. El bloqueo se mira ANTES de comprobar la contraseña: mientras dura,
 * ni la buena entra (si no, el atacante sabría cuándo acertó).
 *
 * ⚠️ La IP sale de `x-forwarded-for`, que el cliente puede inventarse: el límite que de verdad protege es el
 * de la cuenta. El de IP frena a quien prueba muchas cuentas desde el mismo sitio.
 * ⚠️ Quien conoce un correo puede bloquearle la contraseña 15 minutos a propósito. La passkey no pasa por
 * aquí y sigue entrando.
 *
 * Correo e IP se guardan con hash (`gcc_world.intentos_clave`, migración 084).
 */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { getClientIp, hashIp } from '@/lib/world/session';

export const FALLOS_POR_CUENTA = 10;
export const FALLOS_POR_IP = 30;
const MINUTOS = 15;
const HASH_DE_RELLENO = '$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalid';

export class DemasiadosIntentos extends Error {
  constructor() { super('Demasiados intentos'); }
}

/** La respuesta de cada ruta cuando `claveValida` o `comprobarBloqueo` lanzan `DemasiadosIntentos`. */
export function respuestaDemasiadosIntentos() {
  return NextResponse.json(
    { error: `Demasiados intentos. Espera ${MINUTOS} minutos e inténtalo de nuevo.` },
    { status: 429, headers: { 'Retry-After': String(MINUTOS * 60) } },
  );
}

type Opciones = { ip?: boolean };

async function claves(correo: string, { ip = true }: Opciones) {
  const cuenta = 'c:' + hashIp(correo.trim().toLowerCase());
  return { cuenta, ip: ip ? 'i:' + hashIp(await getClientIp()) : null };
}

/** Lanza `DemasiadosIntentos` si la cuenta o la IP ya pasaron el tope. */
export async function comprobarBloqueo(correo: string, op: Opciones = {}): Promise<void> {
  const k = await claves(correo, op);
  const { rows: [r] } = await pool.query(
    `SELECT count(*) FILTER (WHERE clave = $1)::int AS cuenta,
            count(*) FILTER (WHERE clave = $2)::int AS ip
       FROM gcc_world.intentos_clave
      WHERE clave = ANY($3) AND creado > NOW() - make_interval(mins => $4)`,
    [k.cuenta, k.ip, [k.cuenta, k.ip].filter(Boolean), MINUTOS],
  );
  if (r.cuenta >= FALLOS_POR_CUENTA || r.ip >= FALLOS_POR_IP) throw new DemasiadosIntentos();
}

/** Anota un fallo (también el de un correo que no existe: así no sirve recorrer una lista de correos). */
export async function anotarFallo(correo: string, op: Opciones = {}): Promise<void> {
  const k = await claves(correo, op);
  await pool.query(
    `INSERT INTO gcc_world.intentos_clave (clave) SELECT unnest($1::text[])`,
    [[k.cuenta, k.ip].filter(Boolean)],
  );
  // Limpieza de paso, de vez en cuando: lo de más de un día ya no cuenta para nada.
  if (Math.random() < 0.02) {
    await pool.query(`DELETE FROM gcc_world.intentos_clave WHERE creado < NOW() - INTERVAL '1 day'`);
  }
}

/**
 * Sustituye a `verifyPassword` en las entradas: mira el bloqueo, comprueba y anota el fallo.
 * Sin `hash` (cuenta sin contraseña) cuenta como fallo.
 */
export async function claveValida(
  correo: string, clave: string, hash: string | null | undefined, op: Opciones = {},
): Promise<boolean> {
  await comprobarBloqueo(correo, op);
  // Sin cuenta también se calcula un bcrypt: que el tiempo de respuesta no diga si el correo existe.
  const ok = hash ? await verifyPassword(clave, hash) : (await verifyPassword(clave, HASH_DE_RELLENO), false);
  if (!ok) await anotarFallo(correo, op);
  return ok;
}
