/**
 * UN REGISTRO CADA 24 HORAS POR EQUIPO (Fernando, 2026-10-29).
 *
 * *«limitar que la misma IP o equipo genere registros de candidato o cliente de forma seguida:
 * después de crear una cuenta no podrá crear otra hasta pasadas 24 horas… y debe salir el aviso
 * en las tarjetas»*. Sustituye a la regla anterior, que reconocía el equipo PARA SIEMPRE
 * («ya tienes una cuenta en este dispositivo», «ya te postulaste») y cerraba el paso a registros
 * legítimos: la máquina de un cibercafé, una familia, quien se equivocó de correo…
 *
 * · Cuenta como registro: una POSTULACIÓN de candidato y un ALTA de cliente. Completar la cuenta
 *   de un candidato ya aprobado no cuenta (no es un registro nuevo).
 * · «Equipo» = la misma IP (en hash) O el mismo navegador (cookie `gcc_dispositivo`, 1 año).
 * · Se guarda en `gcc_world.registros_recientes` (una fila por registro); no toca las tablas de
 *   cuentas.
 * · ⚠️ La IP la comparten a veces muchas personas (la red de una oficina, o la de una operadora
 *   móvil): un registro desde ella pausa a los demás durante 24 h. Es lo pedido; si molesta, se
 *   puede limitar SOLO por navegador quitando la condición de IP en `ultimoRegistro`.
 *
 * SIN LÍMITE (solo los de Fernando, él decide cuáles):
 * · IPs en la variable `REGISTRO_SIN_LIMITE_IPS` (separadas por comas), o
 * · un navegador marcado por un ADMIN desde `/api/admin/registro-libre` (cookie firmada).
 */

import { createHmac, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { pool } from '@/lib/db';
import { getClientIp, hashIp } from '@/lib/world/session';

export const COOKIE_DISPOSITIVO = 'gcc_dispositivo';
export const COOKIE_REGISTRO_LIBRE = 'gcc_registro_libre';
const HORAS = 24;
const UN_ANIO = 60 * 60 * 24 * 365;

/** La firma del navegador «sin límite»: solo el servidor la sabe calcular. */
export function firmaRegistroLibre(): string {
  const base = process.env.ALTCHA_HMAC_SECRET || process.env.JWT_SECRET || 'gcc-registro-local';
  return createHmac('sha256', base).update('gcc-registro-libre').digest('hex');
}

let tablaLista: Promise<void> | null = null;
function asegurarTabla() {
  // Una vez por proceso, no en cada petición.
  tablaLista ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS gcc_world.registros_recientes (
         id BIGSERIAL PRIMARY KEY,
         tipo TEXT NOT NULL,
         ip_hash TEXT,
         dispositivo TEXT,
         creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
       );
       CREATE INDEX IF NOT EXISTS registros_recientes_creado ON gcc_world.registros_recientes (creado);`,
    )
    .then(() => undefined)
    .catch((e: unknown) => { tablaLista = null; throw e; });
  return tablaLista;
}

async function quienSoy() {
  const ip = await getClientIp();
  const almacen = await cookies();
  const libresIp = (process.env.REGISTRO_SIN_LIMITE_IPS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const libre = libresIp.includes(ip) || almacen.get(COOKIE_REGISTRO_LIBRE)?.value === firmaRegistroLibre();
  return { ipHash: hashIp(ip), dispositivo: almacen.get(COOKIE_DISPOSITIVO)?.value || null, libre };
}

export interface EstadoRegistro {
  bloqueado: boolean;
  /** Cuándo vuelve a poder registrar (ISO), si está bloqueado. */
  hasta: string | null;
  /** Equipo de Fernando: sin límite. */
  libre: boolean;
}

/** ¿Puede este equipo crear un registro ahora? */
export async function estadoRegistro(): Promise<EstadoRegistro> {
  const { ipHash, dispositivo, libre } = await quienSoy();
  if (libre) return { bloqueado: false, hasta: null, libre: true };
  await asegurarTabla();
  const { rows } = await pool.query(
    `SELECT creado + make_interval(hours => $3) AS hasta
       FROM gcc_world.registros_recientes
      WHERE creado > NOW() - make_interval(hours => $3)
        AND (ip_hash = $1 OR ($2::text IS NOT NULL AND dispositivo = $2))
      ORDER BY creado DESC
      LIMIT 1`,
    [ipHash, dispositivo, HORAS],
  );
  const hasta = rows[0]?.hasta ? new Date(rows[0].hasta).toISOString() : null;
  return { bloqueado: !!hasta, hasta, libre: false };
}

/** Anota un registro hecho desde este equipo (y le pone su cookie de equipo si no la tenía). */
export async function anotarRegistro(tipo: 'postulacion' | 'cliente') {
  const { ipHash, dispositivo } = await quienSoy();
  await asegurarTabla();
  const almacen = await cookies();
  const id = dispositivo || randomBytes(24).toString('hex');
  if (!dispositivo) {
    almacen.set(COOKIE_DISPOSITIVO, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: UN_ANIO,
    });
  }
  await pool.query(
    `INSERT INTO gcc_world.registros_recientes (tipo, ip_hash, dispositivo) VALUES ($1, $2, $3)`,
    [tipo, ipHash, id],
  );
}

/** El texto del aviso cuando está bloqueado: «hasta el 30 oct, 14:05». */
export function mensajeBloqueo(hasta: string | null): string {
  if (!hasta) return 'Desde este equipo ya se creó un registro hace poco. Inténtalo más tarde.';
  return `Desde este equipo ya se creó un registro en las últimas 24 horas. Podrás crear otro a partir del ${new Date(hasta).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}.`;
}
