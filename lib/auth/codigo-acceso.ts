/**
 * CÓDIGOS DE ACCESO POR CORREO — una sola regla para todos (seguridad, 2026-11-07).
 *
 * Los usan el inicio de sesión de la web, el del juego (miembro y «ya tengo personaje»), la recuperación
 * del personaje y el segundo paso de los productos. Dos columnas guardan el código:
 * `users.login_code` y `clients.recovery_code`.
 *
 * ⚠️ POR QUÉ: un código de 6 dígitos tiene un millón de valores y vive 15 minutos. Sin contar intentos se
 * adivina a fuerza de peticiones. Aquí el intento se SUMA ANTES DE COMPARAR y en la misma sentencia que
 * lee el código: mil peticiones en paralelo hacen cola en la fila y solo las cinco primeras llegan a
 * comparar. Al quinto fallo el código se anula y hay que pedir otro (lo que exige la contraseña).
 *
 * Quien EMITE un código pone su contador a 0 (`..._intentos = 0` en el mismo UPDATE).
 */
import { randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from '@/lib/db';

export const MAX_INTENTOS_CODIGO = 5;

/** Seis dígitos con aleatoriedad criptográfica (`Math.random` no lo es). */
export const codigoNuevo = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const COLUMNAS = {
  login: { tabla: 'gcc_world.users', codigo: 'login_code', exp: 'login_code_exp', intentos: 'login_code_intentos' },
  recuperacion: { tabla: 'gcc_world.clients', codigo: 'recovery_code', exp: 'recovery_code_exp', intentos: 'recovery_code_intentos' },
} as const;

/** `pool` o el cliente de una transacción (las pruebas la deshacen al final). */
type Bd = { query: typeof pool.query };

export type TipoCodigo = keyof typeof COLUMNAS;
export type ResultadoCodigo = 'ok' | 'sin-codigo' | 'expirado' | 'incorrecto' | 'agotado';

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Comprueba el código de la fila `id` y, si acierta, lo GASTA (no vale para entrar dos veces).
 * Devuelve qué pasó para que cada pantalla diga lo suyo; ver `respuestaCodigo`.
 */
export async function gastarCodigo(
  tipo: TipoCodigo, id: string | number, recibido: string, bd: Bd = pool,
): Promise<ResultadoCodigo> {
  const c = COLUMNAS[tipo];
  const { rows: [fila] } = await bd.query(
    `UPDATE ${c.tabla} SET ${c.intentos} = ${c.intentos} + 1
      WHERE id = $1 AND ${c.codigo} IS NOT NULL
      RETURNING ${c.codigo} AS codigo, ${c.exp} AS exp, ${c.intentos} AS intentos`,
    [id],
  );
  if (!fila) return 'sin-codigo';
  if (!fila.exp || new Date(fila.exp).getTime() < Date.now()) return 'expirado';

  const anular = () => bd.query(
    `UPDATE ${c.tabla} SET ${c.codigo} = NULL, ${c.exp} = NULL WHERE id = $1 AND ${c.codigo} = $2`,
    [id, fila.codigo],
  );
  if (fila.intentos > MAX_INTENTOS_CODIGO) { await anular(); return 'agotado'; }
  if (!iguales(String(fila.codigo), String(recibido ?? '').trim())) {
    if (fila.intentos >= MAX_INTENTOS_CODIGO) { await anular(); return 'agotado'; }
    return 'incorrecto';
  }
  // Gastarlo solo si sigue siendo el mismo: de dos aciertos a la vez, entra uno.
  const { rowCount } = await anular();
  return rowCount ? 'ok' : 'sin-codigo';
}

/** El mensaje y el estado HTTP de cada resultado que no es «ok», iguales en todas las pantallas. */
export function respuestaCodigo(r: Exclude<ResultadoCodigo, 'ok'>): { error: string; status: number } {
  switch (r) {
    case 'sin-codigo': return { error: 'Solicita primero un código', status: 400 };
    case 'expirado': return { error: 'El código expiró, pide uno nuevo', status: 400 };
    case 'agotado': return { error: 'Demasiados intentos: pide un código nuevo', status: 429 };
    default: return { error: 'Código incorrecto', status: 401 };
  }
}
