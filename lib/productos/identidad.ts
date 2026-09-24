import { pool } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { sendCharacterRecoveryCodeEmail } from '@/lib/integrations/email';
import { cuentaEncaja } from '@/lib/auth/tipos';
import { dominioDeLasPasskeys } from '@/lib/world/webauthn';

/**
 * LA IDENTIDAD DE UN CLIENTE DE GCC WORLD, PARA LOS PRODUCTOS.
 *
 * ── QUÉ PIDIÓ FERNANDO (2026-09-24) ─────────────────────────────────────────────
 * «Me interesa que en los productos ya apliquemos la identificación de cuentas de
 * clientes de gcc world, y obligues a ingresar el segundo paso… que repliques lo mismo
 * en las páginas de login de cada producto, en donde verás que hay dos opciones de
 * segundo paso, la passkey o el correo».
 *
 * Y antes, el porqué: «cuando el usuario del tenant tiene cuenta de cliente en gcc world
 * pues el acceso ahora a cualquier tenant, y a su cuenta de gcc world usarán la misma
 * contraseña de gcc world, siendo una sola contraseña su acceso».
 *
 * ── EL RECONOCIMIENTO ES POR CORREO, NO POR UNA CASILLA ─────────────────────────
 * Nadie elige que una cuenta sea «de GCC World»: se **descubre**. Si el correo de una
 * cuenta de un inquilino coincide con una cuenta de CLIENTE de la plataforma, esa persona
 * es la misma persona, y entonces manda su contraseña de GCC World y se le exige el
 * segundo paso. Es lo contrario de lo que había —una opción en un formulario, que fue
 * justo el agujero que se cerró esta misma mañana—: aquí el cliente no decide a quién
 * confiamos, solo se comprueba quién es ya.
 *
 * ── POR QUÉ ESTA LÓGICA VIVE AQUÍ Y NO EN CADA PRODUCTO ─────────────────────────
 * Porque la identidad la posee la plataforma, igual que la facturación. Copiada cinco
 * veces, el día que cambie el segundo factor habría cinco sitios donde cambiarlo y cuatro
 * donde olvidarlo. Los productos preguntan por HTTP (`/api/productos/identidad/*`) con el
 * secreto compartido, exactamente como ya piden un enlace de pago.
 *
 * Se reutilizan las MISMAS tablas y columnas que el login de la plataforma
 * (`users.login_code`, `clients`, `client_passkeys`), así que un código pedido aquí y uno
 * pedido allí son el mismo mecanismo, no dos parecidos.
 */

export type CuentaCliente = {
  id: string;
  email: string;
  nombre: string;
  tienePasskey: boolean;
  /**
   * ⚠️ CUENTAS EXENTAS DEL SEGUNDO PASO (`users.sin_doble_factor`, migración 029).
   *
   * El código va al correo de la cuenta, lo que deja fuera a quien no controla ese buzón.
   * El caso real es el revisor de Meta, cuya cuenta vive en NUESTRO dominio: el código le
   * llegaría a un buzón nuestro, no suyo. La plataforma ya lo contempla, y los productos
   * tienen que contemplarlo igual — si no, al revisor se le cierra la puerta del producto
   * justo cuando está revisándolo.
   *
   * Se marca solo en la base, nunca desde la aplicación.
   */
  sinSegundoPaso: boolean;
};

/** Oculta el correo para poder enseñarlo sin regalarlo: `lf****@grupocc.org`. */
export function taparCorreo(email: string): string {
  const [u, d] = email.split('@');
  if (!d) return email;
  return `${u.slice(0, Math.min(2, u.length))}${'*'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

const codigoNuevo = () =>
  Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');

/** La ficha de cliente del mundo, que es donde cuelgan las passkeys. */
async function fichaCliente(email: string) {
  const { rows } = await pool.query(
    `SELECT id, account_type FROM gcc_world.clients
      WHERE lower(email) = $1 ORDER BY last_seen_at DESC NULLS LAST LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

async function tienePasskey(clientId: number | undefined): Promise<boolean> {
  if (!clientId) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM gcc_world.client_passkeys WHERE client_id = $1 LIMIT 1`,
    [clientId],
  );
  return rows.length > 0;
}

/**
 * ¿Este correo es de un cliente de GCC World?
 *
 * ⚠️ Solo **cliente**. Un candidato comparte `role = 'client'` y se distingue por
 * `clients.account_type` (ver `lib/auth/tipos.ts`); un miembro del grupo tampoco entra
 * por aquí. Confundirlos daría acceso con contraseña de plataforma a quien nunca compró
 * nada.
 *
 * Devuelve `null` si no lo es — y entonces el producto sigue con su propia contraseña,
 * como siempre.
 */
export async function clienteGccPorCorreo(email: string): Promise<CuentaCliente | null> {
  const correo = email.trim().toLowerCase();
  if (!correo) return null;

  const { rows } = await pool.query(
    `SELECT id, email, first_name, last_name, role, is_verified, sin_doble_factor
       FROM gcc_world.users WHERE lower(email) = $1 LIMIT 1`,
    [correo],
  );
  const u = rows[0];
  // Sin verificar no es una identidad todavía: su correo no está probado.
  if (!u || !u.is_verified) return null;

  const ficha = await fichaCliente(correo);
  if (!cuentaEncaja('cliente', { role: u.role, accountType: ficha?.account_type })) return null;

  return {
    id: u.id,
    email: u.email,
    nombre: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email,
    tienePasskey: await tienePasskey(ficha?.id),
    sinSegundoPaso: u.sin_doble_factor === true,
  };
}

/**
 * Comprueba la contraseña de GCC World.
 *
 * ⚠️ Comprueba SIEMPRE contra un hash, exista la cuenta o no: si volviera antes, el
 * tiempo de respuesta diría qué correos son cuentas reales.
 */
export async function claveCorrecta(email: string, clave: string): Promise<boolean> {
  const correo = email.trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT password_hash FROM gcc_world.users WHERE lower(email) = $1 LIMIT 1`,
    [correo],
  );
  const hash = rows[0]?.password_hash;
  if (!hash) {
    await verifyPassword(clave, '$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalid');
    return false;
  }
  return verifyPassword(clave, hash);
}

/** Genera el código del segundo paso y lo manda al correo de la cuenta. */
export async function mandarCodigo(email: string, nombre: string): Promise<void> {
  const correo = email.trim().toLowerCase();
  const codigo = codigoNuevo();
  await pool.query(
    `UPDATE gcc_world.users
        SET login_code = $1, login_code_exp = NOW() + INTERVAL '15 minutes'
      WHERE lower(email) = $2`,
    [codigo, correo],
  );
  await sendCharacterRecoveryCodeEmail(correo, codigo, nombre || 'Usuario');
}

/**
 * Comprueba el código y lo GASTA.
 *
 * ⚠️ Se borra pase lo que pase en cuanto se acierta: un código que siguiera valiendo
 * después de usarse serviría para entrar dos veces, y la segunda podría no ser la misma
 * persona.
 */
export async function codigoCorrecto(email: string, codigo: string): Promise<boolean> {
  const correo = email.trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT id, login_code, login_code_exp FROM gcc_world.users
      WHERE lower(email) = $1 LIMIT 1`,
    [correo],
  );
  const u = rows[0];
  if (!u?.login_code) return false;
  if (!u.login_code_exp || new Date(u.login_code_exp).getTime() < Date.now()) return false;
  if (String(u.login_code) !== String(codigo).trim()) return false;

  await pool.query(
    `UPDATE gcc_world.users SET login_code = NULL, login_code_exp = NULL WHERE id = $1`,
    [u.id],
  );
  return true;
}

/**
 * ¿Desde qué origen puede pedir esto un producto?
 *
 * Solo desde un subdominio de `grupocc.org`. El origen lo manda el producto, y de él
 * depende que una passkey se dé por buena, así que no puede ser cualquiera: sin esta
 * comprobación, quien tuviera el secreto compartido podría hacer que una passkey de un
 * cliente valiera para un sitio suyo.
 */
export function origenDeProductoValido(origen: string): boolean {
  try {
    const u = new URL(origen);
    if (u.protocol !== 'https:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    return u.hostname === 'grupocc.org' || u.hostname.endsWith('.grupocc.org');
  } catch {
    return false;
  }
}

/** El RP de WebAuthn para un producto: su propio origen, pero el dominio de la casa. */
export function rpDelProducto(origen: string) {
  const u = new URL(origen);
  return { origin: u.origin, rpId: dominioDeLasPasskeys(u.hostname) };
}

export { fichaCliente };
