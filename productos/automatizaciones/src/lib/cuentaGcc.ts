import bcrypt from 'bcryptjs';
import { pool } from './db';

/**
 * ENTRAR CON LA CUENTA DE CLIENTE DE GCC WORLD.
 *
 * ── QUÉ PIDIÓ FERNANDO (2026-09-23) ──────────────────────────────────────────────
 * «hay un cliente que ingresa a su producto de Diego Castillo, me interesa que ese
 * cliente con su cuenta de cliente pueda en el login de su tenant de este producto
 * entrar con su cuenta de cliente, misma contraseña».
 *
 * Diego Castillo es el contacto de PETER TOURS S.A., el cliente que ya tiene el agente
 * de WhatsApp funcionando. Hasta hoy entraba por la plataforma; a partir de ahora entra
 * por su inquilino de este producto, y **con la misma contraseña de siempre**.
 *
 * ── POR QUÉ ESTO NO COPIA LA CONTRASEÑA ──────────────────────────────────────────
 * Lo fácil sería copiar el `password_hash` a la tabla `usuarios` de este esquema. Sería
 * un error, y de los que no avisan: el día que el cliente cambie su contraseña en GCC
 * World, aquí seguiría valiendo la vieja. Dos verdades sobre lo mismo siempre acaban
 * separándose, y la que se queda vieja es justo la de seguridad.
 *
 * Así que la contraseña **no vive aquí**: se comprueba contra `gcc_world.users` en el
 * momento de entrar. El usuario de este producto guarda `origen = GCC` y `clave_hash`
 * NULO, que es la forma de decir «a este no le preguntes la contraseña a ti mismo».
 *
 * ── LA EXCEPCIÓN, ACOTADA A PROPÓSITO ────────────────────────────────────────────
 * La regla del producto es que no comparte ni una tabla con `gcc_world`. Esto es la
 * única excepción, y por eso vive en un archivo suyo con su nombre en vez de estar
 * suelta dentro de una acción:
 *
 *   · Se leen DOS columnas (`email`, `password_hash`) de UNA tabla (`gcc_world.users`).
 *   · Es SOLO LECTURA. Este producto no escribe en `gcc_world` jamás.
 *   · Es la misma base y el mismo Postgres, así que no hay una llamada de red que
 *     pueda fallar a mitad: es la misma consulta que la plataforma ya hace al revés
 *     cuando lee `pagado_hasta` de los productos (`lib/productos/accesos.ts`).
 *
 * `bcrypt.compare` es el mismo algoritmo que usa la plataforma (`lib/auth/password.ts`),
 * así que el hash se verifica sin convertir nada.
 */

export type CuentaGcc = {
  id: string;
  email: string;
  nombre: string;
};

/**
 * Comprueba unas credenciales de GCC World. Devuelve la cuenta si son correctas.
 *
 * ⚠️ Devuelve `null` tanto si el correo no existe como si la contraseña es incorrecta.
 * Distinguirlos le diría a quien prueba cuáles de sus correos son cuentas reales.
 */
export async function verificarCuentaGcc(
  email: string,
  clave: string,
): Promise<CuentaGcc | null> {
  const correo = email.trim().toLowerCase();
  if (!correo || !clave) return null;

  const { rows } = await pool.query<{
    id: string;
    email: string;
    password_hash: string | null;
    first_name: string | null;
    last_name: string | null;
  }>(
    `SELECT id, email, password_hash, first_name, last_name
       FROM gcc_world.users
      WHERE lower(email) = $1
      LIMIT 1`,
    [correo],
  );

  const u = rows[0];
  // Sin fila o sin contraseña puesta (cuenta a medio crear) no se entra. Y aun así se
  // gasta una comparación contra un hash de mentira: si se volviera antes, el tiempo
  // de respuesta delataría qué correos existen.
  if (!u?.password_hash) {
    await bcrypt.compare(clave, '$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalid');
    return null;
  }

  const vale = await bcrypt.compare(clave, u.password_hash);
  if (!vale) return null;

  const nombre = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return { id: u.id, email: u.email, nombre: nombre || u.email };
}

/**
 * ¿Existe en GCC World una cuenta con este correo? Se usa al dar de alta un usuario de
 * origen GCC desde el área del equipo o desde la pantalla de usuarios del cliente: si
 * no existe, la cuenta que se cree no podría entrar nunca y nadie se enteraría hasta
 * que el cliente lo intentara.
 */
export async function existeCuentaGcc(email: string): Promise<boolean> {
  const correo = email.trim().toLowerCase();
  if (!correo) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.users WHERE lower(email) = $1 LIMIT 1`,
    [correo],
  );
  return rows.length > 0;
}
